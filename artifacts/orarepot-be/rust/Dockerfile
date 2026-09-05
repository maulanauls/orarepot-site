FROM rust:bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock* ./
COPY crates ./crates
ARG CRATE=identity
RUN cargo build --release -p ${CRATE}

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ARG CRATE=identity
COPY --from=build /src/target/release/${CRATE} /usr/local/bin/service
EXPOSE 8101 8102 8103
ENTRYPOINT ["/usr/local/bin/service"]
