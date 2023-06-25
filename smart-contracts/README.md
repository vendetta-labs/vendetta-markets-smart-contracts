# Vendetta Markets - Smart Contracts

## How it works

Vendetta Markets is a decentralized esports betting platform deployed on the Optimism network. The protocol operates through a combination of simple contracts, the most important being the `GameMarket`, which holds all the bets placed by the users. 

Uses an oracle system fed by a trusted game feed, the protocol accurately determines the outcomes of the markets. 

The winnings are then automatically distributed to the users who bet on the winning side, proportionate to their contribution from the total winning pool.

## Install dependencies

```shell
npm install
```

## Compile contracts

```shell
npm run compile
```

## Run tests

```shell
npm run test
```
