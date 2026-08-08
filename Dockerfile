# Multi-stage build for the warren relay.
#
# Nixpacks' default Rust pipeline builds with Nix and its runtime stage
# lacks Nix's dynamic linker, so the built binary fails to start
# ("required file not found"). This Dockerfile uses the standard Debian
# glibc toolchain for BOTH build and runtime, so the binary runs.
#
# Runtime shape: Railway runs the image with a start command that passes
# $PORT (the internal port) and $ADVERTISE (the public host:port from the
# TCP proxy) to `warren relay` (see railway.json).

FROM rust:1.97-bookworm AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim
COPY --from=build /app/target/release/warren /usr/local/bin/warren
COPY start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh
# The relay needs its own runtime dir (keys, claims); non-root user.
RUN useradd --create-home --shell /usr/sbin/nologin warren
USER warren
WORKDIR /home/warren
