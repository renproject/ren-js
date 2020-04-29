# `🛠️ ren-js` and `gateway-js`

[![Version](https://img.shields.io/npm/v/@renproject/ren)](https://www.npmjs.com/package/@renproject/ren) [![CircleCI](https://img.shields.io/circleci/build/gh/renproject/ren-js)](https://circleci.com/gh/renproject/ren-js)

There's two official Javascript SDKs for interacting with [RenVM](https://renproject.io):

1. **GatewayJS** ([`gateway-js` repository](./packages/lib/gateway)): The simplest way to get started, providing a full user experience.
2. **RenJS** ([`ren-js` repository](./packages/lib/ren)): A lower-level SDK which can be integrated into your existing user interface.

See the [Getting Started Tutorial](https://docs.renproject.io/developers/tutorial/getting-started) to start using RenJS.

## Changelog

* 1.0.0
  * A Web3 provider is now required for GatewayJS. Transfer parameters should now include a `web3Provider` field. Migrate quickly using `web3Provider: await GatewayJS.utils.useBrowserWeb3()`.
  * Resuming existing orders in GatewayJS must use `recoverTransfer`, providing the `HistoryEvent`, as well as a Web3 provider as a second parameter.
  * GatewayJS's storage structure has changed, requiring any incomplete trades to be reopened (instead of being resumed with `recoverTransfer`).

* 0.10.0
  * `shiftIn` and `shiftOut` have been renamed to `lockAndMint` and `burnAndRelease`

* 0.9.0
  * `@renproject/gateway-js` has been renamed to `@renproject/gateway`.
  * GatewayJS now exposes `shiftIn`, `shiftOut` and `recoverShift` instead of just `open`.
  * `@renproject/interfaces`, `@renproject/chains`, `@renproject/provider`, `@renproject/rpc` and `@renproject/utils` can now be imported separately to access internal RenJS functions.
  * RenJS now accepts an optional second parameter, `provider`, for providing a custom JSON RPC handler.

## Local development

```sh
git clone git@github.com:renproject/ren-js.git && cd ren-js
yarn && yarn run link
yarn build
```
