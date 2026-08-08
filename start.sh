#!/bin/sh
# Railway entrypoint: one image, two roles, selected by $WARREN_MODE.
#
#   WARREN_MODE=relay   (default) warren relay --start --bind 0.0.0.0
#                                --port $PORT --advertise $ADVERTISE
#   WARREN_MODE=listen            warren ratchet-init --home $HOME (once),
#                                then warren listen 0.0.0.0:$PORT --home $HOME
#
# Env vars are NOT shell-expanded when Railway runs a Dockerfile start
# command in exec form, so this script is invoked through `sh -c` (see
# railway.json) and does its own expansion.
set -e

MODE="${WARREN_MODE:-relay}"
HOME_DIR="${WARREN_HOME:-/home/warren}"

if [ "$MODE" = "listen" ]; then
  # One-time ratchet identity for the receiver. If it already exists this
  # exits 1 and aborts the container — the identity (and its sessions) must
  # not be silently recreated. For a stateless demo receiver, a fresh home
  # on each boot is fine; the sender must be re-pointed at the new id/otk.
  warren ratchet-init --home "$HOME_DIR" 2>&1 || true
  exec warren listen "0.0.0.0:$PORT" --home "$HOME_DIR"
fi

exec warren relay --start --bind 0.0.0.0 --port "$PORT" --advertise "$ADVERTISE"
