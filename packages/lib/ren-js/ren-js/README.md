# RenVM SDK

[![npm version](http://img.shields.io/npm/v/@renproject/ren.svg?style=flat)](https://npmjs.org/package/@renproject/ren "View this project on npm")
[![CircleCI](https://circleci.com/gh/renproject/renvm-sdk-js.svg?style=shield&circle-token=6fc560c540eff6670e5675841d34b9769b887a49)](https://circleci.com/gh/renproject/renvm-sdk-js)
![Testnet status](https://img.shields.io/endpoint?url=https://ren-status.herokuapp.com/api/shield/renproject/renvm-sdk-js/testnet)

The official Javascript SDK for interacting with the [RenVM](https://renproject.io).

## Links

* [Official SDK Docs](https://app.gitbook.com/@renproject/s/developers)
* [Cloneable Examples](https://github.com/republicprotocol/dex-demo)

## Installation

Add the RenVM SDK using Yarn/npm:

```bash
yarn add @renproject/ren
```
or
```bash
npm install --save @renproject/ren
```

## Importing the SDK

Importing using the require syntax

```typescript
const RenVM = require("@renproject/ren").default;
```

Importing using the ES6 syntax

```typescript
import RenVM from "@renproject/ren";
```

## Usage

```typescript
const sdk = new RenVM("testnet");
```

For more information, [check out an example](https://app.gitbook.com/@renproject/s/developers/examples/bitcoin-payments).

<hr />

## Dev

### Building

```bash
yarn run watch
# or
yarn run build
```

### Tests

You'll need to:

1. Generate a mnemonic and send ETH (kovan for testnet) (path: `m/44'/60'/0'/0/`)
2. Generate a private key and send BTC and ZEC (tBTC and TAZ for testnet)
3. Generate an Infura API key

Create a `.env` file which contains the following exported variables:

```bash
export MNEMONIC="your mnemonic here"
export TESTNET_BITCOIN_KEY="your bitcoin private key (encoded in WIF)"
export INFURA_KEY="your infura key (for it's v3 endpoint)"
export NETWORK="mainnet or testnet"
```

Then just run the following command to execute the tests. Make sure there is sufficient Kovan ETH in the linked account before running tests.

```bash
yarn run test
```

### Update Typescript bindings

In order to update the bindings in `src/contracts/bindings`, you need to clone [`darknode-sol`](https://github.com/renproject/darknode-sol) and run:

```bash
yarn run bindings:ts
```
