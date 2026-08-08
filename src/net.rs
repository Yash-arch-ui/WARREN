//! Minimal plain-TCP wire protocol for M1/M2.
//!
//! Transport obfuscation is explicitly out of scope (§8.1/M-later); this is
//! length-prefixed framing over TCP so local relay processes can talk.
//!
//! Frame layout: `[u32 BE length][u8 frame_type][body]` where `length`
//! covers the type byte + body. One request per connection.

use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream};

pub const FRAME_SPHINX: u8 = 0x01; // body = [u16 proof_len][proof][sphinx packet bytes]
pub const FRAME_INFO_REQ: u8 = 0x02; // body = empty
pub const FRAME_INFO_RESP: u8 = 0x03; // body = relay's self-signed claim (canonical ‖ 64-byte ed25519 sig)
pub const FRAME_DELIVER: u8 = 0x04; // relay -> client: body = plaintext message

/// Hard cap on frame size. A Sphinx packet is a fixed 1024-byte payload plus
/// a small header and the proof (≤ 74 + 256 bytes), so ~2 KiB covers every
/// legitimate frame. The cap is a DoS guard: without it an attacker who can
/// reach a relay (or a malicious relay reaching a client) could send a
/// 4 GiB length prefix and force an unbounded allocation.
pub const MAX_FRAME_SIZE: usize = 16 * 1024;

/// Addresses travel inside 32-byte Sphinx header fields (NODE/DESTINATION
/// ADDRESS_LENGTH). We encode the ASCII "ip:port" string, NUL-padded.
pub const ADDRESS_FIELD_LEN: usize = 32;

pub fn connect(addr: &str) -> io::Result<TcpStream> {
    TcpStream::connect(addr)
}

pub fn send_frame(stream: &mut TcpStream, ty: u8, body: &[u8]) -> io::Result<()> {
    let len = (body.len() + 1) as u32;
    let mut buf = Vec::with_capacity(4 + len as usize);
    buf.extend_from_slice(&len.to_be_bytes());
    buf.push(ty);
    buf.extend_from_slice(body);
    stream.write_all(&buf)
}

/// Reads one frame. `Ok(None)` on a clean EOF at a frame boundary.
pub fn recv_frame(stream: &mut TcpStream) -> io::Result<Option<(u8, Vec<u8>)>> {
    let mut len_buf = [0u8; 4];
    match stream.read_exact(&mut len_buf) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len = u32::from_be_bytes(len_buf) as usize;
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
    let mut body = vec![0u8; len];
    stream.read_exact(&mut body)?;
    let ty = body[0];
    Ok(Some((ty, body[1..].to_vec())))
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
        // A malicious peer sends an oversized length prefix; the reader must
        // reject it without attempting to allocate/read the body.
        std::io::Write::write_all(&mut client, &(MAX_FRAME_SIZE as u32 + 1).to_be_bytes()).unwrap();
        let err = handle.join().unwrap().unwrap();
        assert!(err.contains("MAX_FRAME_SIZE"), "got: {err}");
    }
}
