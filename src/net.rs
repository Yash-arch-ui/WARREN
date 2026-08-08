//! Minimal plain-TCP wire protocol, with M8 TLS-record-layer dressing.
//!
//! **Inner frame layout:** `[u32 BE length][u8 frame_type][body]` where
//! `length` covers the type byte + body. One request per connection.
//!
//! **Wire layout (M8):** every inner frame is wrapped in a TLS 1.2
//! application-data record shell — `[0x17][0x03 0x03][u16 record_len][inner
//! frame]` — before hitting the wire, so a passive DPI observer sees byte
//! streams structurally consistent with an established HTTPS/TLS session
//! rather than a raw, distinctively-shaped custom protocol. Inner frames
//! larger than a TLS record's 16 KiB plaintext cap are split across
//! multiple records and reassembled on read. Both relay and client sides
//! use these same functions, so the wrap/unwrap is consistent everywhere
//! and the routing/mixing logic underneath is unchanged.
//!
//! **Honest bound (M8, `docs/THREAT_MODEL.md` §5):** this defeats *naive
//! protocol-shape fingerprinting* — a classifier keyed on the old raw
//! `[u32 len]` prefix. It is **not** a real TLS session: there is no
//! handshake (a stream of pure application-data records), so active
//! probing or a sophisticated DPI system doing full protocol validation
//! will notice. Pluggable-transport-grade resistance (obfs4-equivalent) is
//! explicitly out of scope for this project.

use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream};

pub const FRAME_SPHINX: u8 = 0x01; // body = [u16 proof_len][proof][sphinx packet bytes]
pub const FRAME_INFO_REQ: u8 = 0x02; // body = empty
pub const FRAME_INFO_RESP: u8 = 0x03; // body = relay's self-signed claim (canonical ‖ 64-byte ed25519 sig)
pub const FRAME_DELIVER: u8 = 0x04; // relay -> client: body = plaintext message

/// Hard cap on **inner** frame size. A Sphinx packet is a fixed 1024-byte
/// payload plus a small header and the proof (≤ 74 + 256 bytes), so ~2 KiB
/// covers every legitimate frame; the cap is a DoS guard (without it an
/// attacker who can reach a relay could send a 4 GiB length prefix and
/// force an unbounded allocation). The cap sits *above* a single TLS
/// record's 16 KiB plaintext bound on purpose, so the M8 wrapper genuinely
/// exercises multi-record chunking for large frames.
pub const MAX_FRAME_SIZE: usize = 32 * 1024;

/// TLS 1.2 application-data record type byte.
const TLS_RECORD_APP_DATA: u8 = 0x17;
/// TLS 1.2 record version bytes.
const TLS_RECORD_VERSION: [u8; 2] = [0x03, 0x03];
/// TLS 1.2 record plaintext cap (2^14 bytes).
pub const TLS_RECORD_PLAINTEXT_MAX: usize = 1 << 14;

/// Wrap an inner frame in TLS-record shells: one `[0x17 03 03][u16 len]
/// [chunk]` record per ≤ 16 KiB chunk (the TLS plaintext cap). Exposed so
/// tests can inspect the exact wire bytes.
pub fn wrap_record(inner: &[u8]) -> Vec<u8> {
    let records = inner.len().div_ceil(TLS_RECORD_PLAINTEXT_MAX);
    let mut out = Vec::with_capacity(inner.len() + records * 5);
    for chunk in inner.chunks(TLS_RECORD_PLAINTEXT_MAX) {
        out.push(TLS_RECORD_APP_DATA);
        out.extend_from_slice(&TLS_RECORD_VERSION);
        out.extend_from_slice(&(chunk.len() as u16).to_be_bytes());
        out.extend_from_slice(chunk);
    }
    out
}

/// Addresses travel inside 32-byte Sphinx header fields (NODE/DESTINATION
/// ADDRESS_LENGTH). We encode the ASCII "ip:port" string, NUL-padded.
pub const ADDRESS_FIELD_LEN: usize = 32;

pub fn connect(addr: &str) -> io::Result<TcpStream> {
    TcpStream::connect(addr)
}

pub fn send_frame(stream: &mut TcpStream, ty: u8, body: &[u8]) -> io::Result<()> {
    let len = (body.len() + 1) as u32;
    let mut inner = Vec::with_capacity(4 + len as usize);
    inner.extend_from_slice(&len.to_be_bytes());
    inner.push(ty);
    inner.extend_from_slice(body);
    stream.write_all(&wrap_record(&inner))
}

/// Reads one frame (unwrapping the M8 TLS-record shell). `Ok(None)` on a
/// clean EOF at a frame boundary.
///
/// Protocol invariant: **one frame per record set** — our `send_frame`
/// wraps each frame in its own record(s) and never packs two frames into
/// one record, so any surplus bytes beyond the parsed frame are discarded
/// deliberately (a non-conforming peer packing multiple frames per record
/// would lose the surplus).
pub fn recv_frame(stream: &mut TcpStream) -> io::Result<Option<(u8, Vec<u8>)>> {
    let mut inner = Vec::new();
    loop {
        // One TLS record header: [type][version 2][u16 record_len].
        let mut hdr = [0u8; 5];
        match stream.read_exact(&mut hdr) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof && inner.is_empty() => {
                return Ok(None);
            }
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "connection closed in the middle of a TLS record",
                ));
            }
            Err(e) => return Err(e),
        }
        if hdr[0] != TLS_RECORD_APP_DATA || hdr[1..3] != TLS_RECORD_VERSION {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "frame is not a TLS 1.2 application-data record",
            ));
        }
        let rec_len = u16::from_be_bytes([hdr[3], hdr[4]]) as usize;
        if rec_len == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "empty TLS record",
            ));
        }
        let mut rec = vec![0u8; rec_len];
        stream.read_exact(&mut rec)?;
        inner.extend_from_slice(&rec);

        // Parse the inner frame once its 4-byte length prefix is in hand.
        if inner.len() >= 4 {
            let len = u32::from_be_bytes(inner[0..4].try_into().unwrap()) as usize;
            if len == 0 {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "zero-length frame",
                ));
            }
            if len > MAX_FRAME_SIZE {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("frame of {len} bytes exceeds MAX_FRAME_SIZE ({MAX_FRAME_SIZE})"),
                ));
            }
            if inner.len() >= 4 + len {
                let ty = inner[4];
                return Ok(Some((ty, inner[5..4 + len].to_vec())));
            }
        }
    }
}

/// Encode an "ip:port" string into a fixed 32-byte field (ASCII, NUL-padded).
pub fn addr_to_field(addr: &str) -> anyhow::Result<[u8; ADDRESS_FIELD_LEN]> {
    if addr.len() > ADDRESS_FIELD_LEN {
        anyhow::bail!("address `{addr}` does not fit in a {ADDRESS_FIELD_LEN}-byte header field");
    }
    let mut field = [0u8; ADDRESS_FIELD_LEN];
    field[..addr.len()].copy_from_slice(addr.as_bytes());
    Ok(field)
}

/// Decode a fixed 32-byte field back into an "ip:port" string.
pub fn field_to_addr(field: &[u8; ADDRESS_FIELD_LEN]) -> String {
    let end = field.iter().position(|&b| b == 0).unwrap_or(field.len());
    String::from_utf8_lossy(&field[..end]).into_owned()
}

/// Bind a listener on an ephemeral port and return (listener, "ip:port").
pub fn bind_any() -> io::Result<(TcpListener, String)> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let addr = listener.local_addr()?.to_string();
    Ok((listener, addr))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn address_field_round_trip() {
        for addr in ["127.0.0.1:7001", "127.0.0.1:65535", "localhost:1234"] {
            let field = addr_to_field(addr).unwrap();
            assert_eq!(field_to_addr(&field), addr);
        }
    }

    #[test]
    fn address_too_long_rejected() {
        assert!(addr_to_field("0123456789-0123456789-0123456789-0123456789").is_err());
    }

    #[test]
    fn frame_round_trip() {
        let (listener, addr) = bind_any().unwrap();
        let handle = std::thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            recv_frame(&mut s).unwrap()
        });
        let mut client = connect(&addr).unwrap();
        send_frame(&mut client, FRAME_SPHINX, b"payload-bytes").unwrap();
        let (ty, body) = handle.join().unwrap().unwrap();
        assert_eq!(ty, FRAME_SPHINX);
        assert_eq!(body, b"payload-bytes");
    }

    #[test]
    fn oversized_frame_rejected() {
        let (listener, addr) = bind_any().unwrap();
        let handle = std::thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            recv_frame(&mut s).err().map(|e| e.to_string())
        });
        let mut client = connect(&addr).unwrap();
        // A malicious peer sends an oversized inner length prefix inside the
        // TLS record shell; the reader must reject it without attempting to
        // allocate/read the body.
        let mut inner = (MAX_FRAME_SIZE as u32 + 1).to_be_bytes().to_vec();
        inner.push(FRAME_SPHINX);
        std::io::Write::write_all(&mut client, &wrap_record(&inner)).unwrap();
        let err = handle.join().unwrap().unwrap();
        assert!(err.contains("MAX_FRAME_SIZE"), "got: {err}");
    }

    // --- M8: TLS-record-layer wire dressing ---

    #[test]
    fn wire_bytes_are_tls_record_shaped() {
        // The old raw wire started with the inner frame's [u32 len] prefix
        // (for a small frame the first byte is 0x00). M8 wrapping means a
        // passive observer now first sees a TLS 1.2 application-data record
        // header — structurally different from the old raw framing.
        let inner = {
            let len = (b"payload".len() + 1) as u32;
            let mut f = len.to_be_bytes().to_vec();
            f.push(FRAME_SPHINX);
            f.extend_from_slice(b"payload");
            f
        };
        let wire = wrap_record(&inner);

        assert_eq!(wire[0], 0x17, "record type = TLS application data");
        assert_eq!(&wire[1..3], &[0x03, 0x03], "TLS 1.2 version");
        let rec_len = u16::from_be_bytes([wire[3], wire[4]]) as usize;
        assert_eq!(
            rec_len,
            inner.len(),
            "record length matches the inner frame"
        );
        assert_eq!(
            &wire[5..],
            &inner[..],
            "inner frame intact behind the header"
        );

        // The old raw encoding of the same frame starts with 0x00 (the u32
        // length high byte) — the wrapper genuinely changed the first
        // observable bytes, not just the container.
        assert_ne!(wire[0], inner[0]);
        assert!(
            rec_len <= TLS_RECORD_PLAINTEXT_MAX,
            "single record under the TLS cap"
        );
    }

    #[test]
    fn raw_tcp_wire_is_tls_record_shaped_and_parses() {
        // Real wire bytes read with a raw TcpStream (bypassing recv_frame):
        // the peer's response must be TLS-record-shaped *and* still parse as
        // a frame — the wrapper is observable on the wire, not just in
        // memory.
        let (listener, addr) = bind_any().unwrap();
        let handle = std::thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            let _ = recv_frame(&mut s).unwrap();
            send_frame(&mut s, FRAME_INFO_RESP, b"hello").unwrap();
        });
        let mut client = std::net::TcpStream::connect(&addr).unwrap();
        send_frame(&mut client, FRAME_INFO_REQ, &[]).unwrap();

        let mut hdr = [0u8; 5];
        client.read_exact(&mut hdr).unwrap();
        assert_eq!(hdr[0], 0x17, "response is TLS-record-shaped on the wire");
        assert_eq!(&hdr[1..3], &[0x03, 0x03]);
        let rec_len = u16::from_be_bytes([hdr[3], hdr[4]]) as usize;
        let mut inner = vec![0u8; rec_len];
        client.read_exact(&mut inner).unwrap();
        let frame_len = u32::from_be_bytes(inner[0..4].try_into().unwrap()) as usize;
        assert_eq!(inner[4], FRAME_INFO_RESP);
        assert_eq!(&inner[5..4 + frame_len], b"hello");
        handle.join().unwrap();
    }

    #[test]
    fn large_frame_spans_tls_records_and_reassembles() {
        // A frame at the size cap exceeds a single TLS record's 16 KiB
        // plaintext bound, so the sender chunks it and the receiver
        // reassembles it across records.
        let (listener, addr) = bind_any().unwrap();
        let handle = std::thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            recv_frame(&mut s).unwrap()
        });
        let mut client = connect(&addr).unwrap();
        let big = vec![0xab; 20_000];
        send_frame(&mut client, FRAME_SPHINX, &big).unwrap();
        let (ty, body) = handle.join().unwrap().unwrap();
        assert_eq!(ty, FRAME_SPHINX);
        assert_eq!(body, big, "20 KiB body survives record chunking");
    }
}
