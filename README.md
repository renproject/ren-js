# `🛠️ ren-js`

[![Version](https://img.shields.io/npm/v/@renproject/ren)](https://www.npmjs.com/package/@renproject/ren)

The official Javascript SDK for interacting with [RenVM](https://renproject.io).

## Integration options

1. **RenBridge** ([bridge.renproject.io](https://bridge.renproject.io)): Link out to RenBridge if you require users to have renBTC and other bridged assets.
2. **RenJS** ([`RenJS` repository](./packages/lib/ren)): A lower-level SDK which can be integrated into your existing user interface.
3. **RenTX** ([`RenTX` repository](./packages/lib/rentx)): A wrapper around RenJS to make handling transaction state easier.
4. **Multiwallet** ([`Multiwallet UI` repository](./packages/ui/multiwallet-ui)): A library for handling user wallet connections for various blockchains.

## Docs

See the [Getting Started Tutorial](https://docs.renproject.io/developers/tutorial/getting-started) to start using RenJS.

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

## Adding chains

See [./packages/lib/chains/chains/README.md](./packages/lib/chains/chains/README.md).
