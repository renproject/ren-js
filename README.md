# `🛠️ ren-js` and `gateway-js`

There's two official Javascript SDKs for interacting with [RenVM](https://renproject.io):

1. **GatewayJS** ([`gateway-js` repository](./packages/lib/gateway)): The simplest way to get started, providing a full user experience.
2. **RenJS** ([`ren-js` repository](./packages/lib/ren)): A lower-level SDK which can be integrated into your existing user interface.

See the [Getting Started Tutorial](https://docs.renproject.io/developers/tutorial/getting-started) to start using RenJS.

## Changelog

* 0.9.0
  * `@renproject/gateway-js` has been renamed to `@renproject/gateway`.
  * GatewayJS now exposes `shiftIn`, `shiftOut` and `recoverShift` instead of just `open`.
  * `@renproject/interfaces`, `@renproject/chains`, `@renproject/provider`, `@renproject/rpc` and `@renproject/utils` can now be imported seperately to access internal RenJS functions.
  * RenJS now accepts an optional second parameter, `provider`, for providing a custom JSON RPC handler.
