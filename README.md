# `🛠️ ren-js`

[![Version](https://img.shields.io/npm/v/@renproject/ren)](https://www.npmjs.com/package/@renproject/ren)

The official Javascript SDK for interacting with [RenVM](https://renproject.io).

## Integration options

1. **RenBridge** ([bridge.renproject.io](https://bridge.renproject.io)): Link out to RenBridge if you require users to have renBTC and other bridged assets.
2. **RenJS** ([`RenJS` repository](./packages/ren)): An SDK for integrating into your own user interface.
3. **RenTX** ([`RenTX` repository](./packages/ren-tx)): A wrapper around RenJS to make handling transaction state easier.
4. **Multiwallet** ([`Multiwallet UI` repository](./packages/ui/multiwallet-ui)): A library for handling user wallet connections for various blockchains.

## Docs

_See [./packages/ren/README.md](./packages/ren/README.md) for basic usage, and the [Getting Started Tutorial](https://docs.renproject.io/developers/tutorial/getting-started) for a guide on bridging assets._

### Changelog

See the [Releases page](https://github.com/renproject/ren-js/releases).

## Local development

Clone the repository, install the dependencies and build:

```sh
git clone git@github.com:renproject/ren-js.git && cd ren-js
yarn && yarn run link-all
yarn build
```

You can now use your local `RenJS` build by running the following in the target repository:

```sh
yarn link @renproject/ren
```

## Package list

-   [`ren`](./ren) - Javascript SDK for interacting with RenVM.
-   [`interfaces`](./interfaces) - Typescript definitions.
-   [`utils`](./utils) - Helper functions used by the other packages.
-   [`provider`](./provider) - JSON-RPC provider.
-   [`mock-provider`](./mock-provider) - For testing without a RenVM instance.
-   [`test`](./test) - Integration tests (not published)
-   chains - Packages for adding support for blockchains and assets.
-   -   [`chains-bitcoin`](./chains/chains-bitcoin)
-   -   [`chains-terra`](./chains/chains-terra)
-   -   [`chains-filecoin`](./chains/chains-filecoin)
-   -   [`chains-ethereum`](./chains/chains-ethereum)
-   -   [`chains-solana`](./chains/chains-solana)
-   -   [`chains`](./chains/chains)

## Adding chains

See [./packages/chains/chains/README.md](./packages/chains/chains/README.md).
