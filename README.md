# `🛠️ ren-js` and `gateway-js`

[![Version](https://img.shields.io/npm/v/@renproject/ren)](https://www.npmjs.com/package/@renproject/ren) [![CircleCI](https://img.shields.io/circleci/build/gh/renproject/ren-js)](https://circleci.com/gh/renproject/ren-js)

There's two official Javascript SDKs for interacting with [RenVM](https://renproject.io):

1. **GatewayJS** ([`gateway-js` repository](./packages/lib/gateway)): The simplest way to get started, providing a full user experience.
2. **RenJS** ([`ren-js` repository](./packages/lib/ren)): A lower-level SDK which can be integrated into your existing user interface.

See the [Getting Started Tutorial](https://docs.renproject.io/developers/tutorial/getting-started) to start using RenJS.

### Changelog

See the [Releases page](https://github.com/renproject/ren-js/releases).

### Local development

Build RenJS and GatewayJS:

```sh
git clone git@github.com:renproject/ren-js.git && cd ren-js
yarn && yarn run link
yarn build
```

Start gateway.renproject.io
```sh
cd packages/ui/gateway.renproject.io
PORT=3344 yarn start
```

Start demo page
```sh
cd packages/ui/gateway-example
PORT=3000 yarn start
```

Go to <http://localhost:3000/?network=testnet&endpoint=http://localhost:3344>.
