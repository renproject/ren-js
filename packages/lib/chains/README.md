# Adding chains

Once a chain has been added to the [multichain repo](https://github.com/renproject/multichain) and accepted by the darknodes, a handler can be written for RenJS.

The expected interface can be found in `../interfaces/src/chain.ts`. There are two types of chains - lock chains and mint chains, each requiring a different handler interface. Lock chain handlers are for chains where funds are locked up under RenVM's control - e.g. Bitcoin or Zcash. A mint chain handler is for the chain where the wrapped tokens are created - e.g. Ethereum.

If a chain is a fork of another supported chain, it's recommended that the handler extends the forked chain's handler.

If a chain has multiple assets (e.g. ETH and ERC20s), it's recommended that a single handler is written that supports all the relevant assets.
