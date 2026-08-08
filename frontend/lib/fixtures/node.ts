/**
 * Static fixtures for mock mode: what a small three-relay network looks like
 * from one node.
 *
 * The keys are deterministic stand-ins (SHA-256 of a label), not real key
 * material — they exist so the UI has something correctly shaped to render.
 */
import type { Directory, Identity, NodeStatus, Peer, Stats } from "../types";

const ENTRY = "127.0.0.1:7001";
const MIDDLE = "127.0.0.1:7002";
const EXIT = "127.0.0.1:7003";

export const MOCK_IDENTITY: Identity = {
  identity: "f776150a80f55aa21d3341c52858a90197ea55d7262fc5103ef5d92dd055b5c7",
  delivery_addr: "127.0.0.1:9001",
  tokens: 46,
};

export const MOCK_PEERS: Peer[] = [
  {
    handle: "bob",
    id: "0e2ce946cd828709f6d2c71b0fe4865e579655abeada4a6fb6d6bcceb2916688",
    addr: "127.0.0.1:9002",
  },
  {
    handle: "carol",
    id: "54284103a0c828668859ab033d12bfb00dc1006486f32d2d5b04f8ca2c9075a9",
    addr: "127.0.0.1:9003",
  },
];

export const MOCK_STATUS: NodeStatus = {
  relays: [ENTRY, MIDDLE, EXIT],
  directory_entries: 3,
  directory_attestations: 2,
  directory_threshold: 2,
  directory_keys: 3,
  tokens: 46,
  max_msg_len: 705,
  packet_payload_bytes: 315,
};

export const MOCK_STATS: Stats = {
  total_messages: 4,
  by_state: { IN_FLIGHT: 1, DELIVERED: 3 },
  sent: 2,
  received: 2,
  bytes: 5_312,
  tokens_spent: 14,
  tokens_remaining: 46,
  relays_in_path: 3,
  directory_entries: 3,
};

export const MOCK_DIRECTORY: Directory = {
  entries: [
    {
      address: ENTRY,
      identity_key: "9e5b686b48df02cbd871acf5a6bcf506095dd5560483a6a12e479197bcae4353",
      sphinx_key: "941758f85b146d7d0caf7978d37815e77647844af51ff3649f71b5f866a69e1f",
      role: "entry",
      status: "IN_PATH",
    },
    {
      address: MIDDLE,
      identity_key: "bb01155e7609a9afcbc3eac9a49a1454cf3489ef55d3b6559323451e439c51d4",
      sphinx_key: "ef2d43f8fb361f7f032767bcf9ddc4c94ae65aaf0fa41e865b29341c76d8d1bc",
      role: "middle",
      status: "IN_PATH",
    },
    {
      address: EXIT,
      identity_key: "233dca489ecce6821255382c161aeeedb74408897733b4174a39fa4d4fa35a6d",
      sphinx_key: "f77be599f68d7647dba43c023f20872a8d92be5f3b07a6d5ea3390e4b5a0d0b5",
      role: "exit",
      status: "IN_PATH",
    },
  ],
  attestations: 2,
  threshold: 2,
  signers: 3,
  policy_enforced: true,
};
