# `🛠️ RenJS`

[![npm version](http://img.shields.io/npm/v/@renproject/ren.svg?style=flat)](https://npmjs.org/package/@renproject/ren "View this project on npm")
[![CircleCI](https://circleci.com/gh/renproject/ren-js.svg?style=shield&circle-token=6fc560c540eff6670e5675841d34b9769b887a49)](https://circleci.com/gh/renproject/ren-js)
![Testnet status](https://img.shields.io/endpoint?url=https://ren-status.herokuapp.com/api/shield/renproject/ren-js/testnet)

The official Javascript SDK for interacting with [RenVM](https://renproject.io).

## Links

* [Developer Docs](https://docs.renproject.io/developers/)
* [Getting Started Tutorial](https://docs.renproject.io/developers/tutorial/getting-started)
* [ChaosDEX](https://github.com/renproject/chaosdex), a cross-chain DEX

## Installation

Install RenJS:

```sh
yarn add @renproject/ren
# Or
npm install --save @renproject/ren
```

## Usage

Usage is described in the [getting started tutorial](https://docs.renproject.io/developers/tutorial/getting-started).

Example of bridging BTC into Ethereum:

```typescript
const renJS = new RenJS("testnet"); // or "chaosnet"
const web3 = new Web3("... Ethereum node or Infura ...");

const amount = 0.001;

const shiftIn = renJS.shiftIn({
    sendToken: "BTC", // Bridge BTC to Ethereum
    sendAmount: RenJS.utils.value(amount, "btc").sats(), // Amount of BTC
    sendTo: "0xe520ec7e6C0D2A4f44033E2cC8ab641cb80F5176", // Recipient Ethereum address
});

const gatewayAddress = shiftIn.addr();
console.log(`Deposit ${amount} BTC to ${gatewayAddress}`);

shiftIn.waitAndSubmit(web3.currentProvider, 0 /* confirmations */)
    .then(console.log)
    .catch(console.error);
```

Example of bridging BTC out of Ethereum:

```typescript
const renJS = new RenJS("testnet"); // or "chaosnet"
const web3 = new Web3("... Ethereum node or Infura ...");

const amount = 0.001;

renJS.shiftOut({
    sendToken: "BTC", // Bridge BTC from Ethereum back to Bitcoin's chain
    sendAmount: RenJS.utils.value(amount, "btc").sats(), // Amount of BTC
    sendTo: "miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6", // Recipient Bitcoin address
    web3Provider: web3.currentProvider,
})
    .readFromEthereum()
    .then(tx => tx.submitToRenVM())
    .then(console.log)
    .catch(console.error);
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
