# `🛠️ GatewayJS`

There's two official Javascript SDKs for interacting with [RenVM](https://renproject.io):

1. **GatewayJS** (this repository): The simplest way to get started, providing a full user experience.
2. **RenJS** ([`ren-js` repository](https://github.com/renproject/ren-js/tree/master/packages/lib/ren)): A lower-level SDK which can be integrated into your existing user interface.

See the [Getting Started Tutorial](https://docs.renproject.io/developers/tutorial/getting-started) to start using GatewayJS.

## Changelog

See the [Releases](https://github.com/renproject/ren-js/releases) page.

## About

GatewayJS is an SDK for bridging BTC, BCH and ZEC to your Ethereum-based dApp. GatewayJS lets your users deposit and withdraw cryptocurrencies into your smart contracts through the following widget:

![GatewayJS screenshot](./screenshot.png)

GatewayJS is browser-only - see [RenJS](https://github.com/renproject/ren-js) if you are using Node.js.

<br />
<hr />
<br />

## Installation

Install GatewayJS using Yarn or npm:

```sh
yarn add @renproject/gateway
# Or
npm install --save @renproject/gateway
```

## Usage

Usage is described in the [getting started tutorial](https://docs.renproject.io/developers/tutorial/getting-started) in the Developer Docs.

Example of bridging BTC into Ethereum:

```typescript
const GatewayJS = require("@renproject/gateway");

new GatewayJS("testnet").open({
    // Send BTC to an Ethereum address
    sendToken: GatewayJS.Tokens.BTC.Btc2Eth,

    // Amount of BTC we are sending
    sendAmount: GatewayJS.utils.value(0.01, "BTC").sats(),

    // The recipient Ethereum address
    sendTo: "0xD5B5b26521665Cb37623DCA0E49c553b41dbF076",
});
```

<br />
<br />
<hr />
<br />

## Developer notes

### Building

```sh
yarn run watch
# or
yarn run build
```

### Running tests

You'll need to:

1. Generate a mnemonic and send ETH (kovan for testnet) (path: `m/44'/60'/0'/0/`)
2. Generate a private key and send BTC and ZEC (tBTC and TAZ for testnet)
3. Generate an Infura API key

Create a `.env` file which contains the following exported variables:

```sh
export MNEMONIC="your mnemonic here"
export TESTNET_BITCOIN_KEY="your bitcoin private key (encoded in WIF)"
export INFURA_KEY="your infura key (for it's v3 endpoint)"
export NETWORK="mainnet or testnet"
```

Then just run the following command to execute the tests. Make sure there is sufficient Kovan ETH in the linked account before running tests.

```sh
yarn run test
```

### Update contract bindings

In order to update the bindings in `src/contracts/bindings`, you need to clone [`darknode-sol`](https://github.com/renproject/darknode-sol) and run:

```sh
yarn run bindings:ts
```
