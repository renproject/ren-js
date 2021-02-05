# `@renproject/chains`

`@renproject/chains` imports all the other chain packages into a single package.

# Adding chains

## Requirements

Before a chain handler is written for RenJS, it should have already been accepted into both the [**multichain repository**](https://github.com/renproject/multichain) and the **darknode repository**.

## Implementation

The expected interface can be found in [`../../interfaces/src/chain.ts`](../../interfaces/src/chain.ts). There are two types of chains - lock chains and mint chains, each requiring a different handler interface. Lock chain handlers are for chains where funds are locked up under RenVM's control - e.g. Bitcoin or Zcash. A mint chain handler is for the chain where the wrapped tokens are created - e.g. Ethereum.

If a chain is a fork of another supported chain, it's recommended that the handler extends the forked chain's handler.

If a chain has multiple assets (e.g. ETH and ERC20s), it's recommended that a single handler is written that supports all the relevant assets.
