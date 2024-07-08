# Vendetta Markets

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

- Install Node.js v18

- Create the build folder:

   ```bash
   cd scripts
   npm install
   npm run build
   ```

- Compile all contracts:

  ```bash
  cargo make rust-optimizer
  ```

- Formatting:

   ```bash
   cd scripts
   npm run format
   npm run lint
   ```

This compiles and optimizes all contracts, storing them in `/artifacts` directory along with `checksum.txt` which contains sha256 hashes of each of the `.wasm` files (The script just uses CosmWasm's [rust-optimizer][9]).

**Note:** Intel/Amd 64-bit processor is required. While there is experimental ARM support for CosmWasm/rust-optimizer, it's discouraged to use in production.

## Deployment

When the deployment scripts run for the first time, it will upload code IDs for each contract, instantiate each contract, initialize assets, and set oracles. If you want to redeploy, you must locally delete the `sei-testnet.json` file in the artifacts directory.

Everything related to deployment must be ran from the `scripts` directory.

```bash
cd scripts

npm run deploy
```

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

## Running script

```bash
wasmkit run scripts/sample-script.ts
```