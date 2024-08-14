# Vendetta Markets

Embrace the adrenaline of esports and the power of decentralized finance with Vendetta Markets, the ultimate platform where skill meets opportunity. Bet on your favorite teams, earn rewards, and experience the thrill of victory like never before.

With a transparent and efficient technical infrastructure, Vendetta Markets offers a seamless and fair betting experience for esports enthusiasts.

This repository contains the source code for the core smart contracts of Vendetta Markets. Smart contracts are meant to be compiled to `.wasm` files and uploaded to the Cosmos chains.

## Environment set up

- Install rustup. Once installed, make sure you have the wasm32 target:

  ```bash
  rustup default stable
  rustup update stable
  rustup target add wasm32-unknown-unknown
  ```

- Install cargo-make

  ```bash
  cargo install --force cargo-make
  ```

- Install Docker

- Install Node.js v16

## Schemas

```bash
cargo make --makefile Makefile.toml generate-all-schemas
```

Creates JSON schema files for relevant contract calls, queries and query responses (See: [cosmwams-schema][10]).

## Linting

`rustfmt` is used to format any Rust source code:

```bash
cargo +nightly fmt
```

`clippy` is used as a linting tool:

```bash
cargo make clippy
```

## Testing

Integration tests (task `integration-test` or `test`) use `.wasm` files. They have to be generated with `cargo make build`.

Run unit tests:

```bash
cargo make unit-test
```

Run integration tests:

```bash
cargo make integration-test
```

Run all tests:

```bash
cargo make test
```

## Compiling contracts

To compile your contracts: 
```bash
wasmkit compile
```

## Deployment

```bash
wasmkit run scripts/deploy-script.ts
```