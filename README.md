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

Install RenJS using Yarn/npm:

```sh
yarn add @renproject/ren
```
or
```sh
npm install --save @renproject/ren
```

## Importing RenJS

Importing using require syntax

```typescript
const RenJS = require("@renproject/ren");
```

Importing using ES6 syntax

```typescript
import RenJS from "@renproject/ren";
```

## Usage

Usage is described in the [getting started tutorial](https://docs.renproject.io/developers/tutorial/getting-started).

Example of bridging BTC into Ethereum:

```typescript
// ... web3 is initialized

const renJS = new RenJS("testnet"); // or "chaosnet"

const amount = 0.001; // testnet BTC

const shiftIn = renJS.shiftIn({
    // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
    sendToken: RenJS.Tokens.BTC.Btc2Eth,

    // Amount of BTC we are sending (in Satoshis)
    sendAmount: Math.floor(amount * (10 ** 8)), // Convert to Satoshis

    // The contract we want to interact with
    sendTo: "0xb2731C04610C10f2eB6A26ad14E607d44309FC10",

    // The name of the function we want to call
    contractFn: "deposit",

    // Arguments expected for calling `deposit`
    contractParams: [
        {
            name: "_msg",
            type: "bytes",
            value: web3.utils.fromAscii(`Depositing ${amount} BTC`),
        }
    ],
});

const gatewayAddress = shiftIn.addr();
this.log(`Deposit ${amount} BTC to ${gatewayAddress}`);

await shiftIn.waitAndSubmit(web3.currentProvider, 0 /* confirmations */);
```

Example of bridging BTC out of Ethereum:

```typescript
// ... zBTC is burnt in the Ethereum transaction `txHash`

const renJS = new RenJS("testnet"); // or "chaosnet"

const shiftOut = await renJS.shiftOut({
    // Send BTC from the Ethereum blockchain to the Bitcoin blockchain.
    sendToken: RenJS.Tokens.BTC.Eth2Btc,

    // The web3 provider to talk to Ethereum
    web3Provider: web3.currentProvider,

    // The transaction hash of our contract call
    txHash,
}).readFromEthereum();

await shiftOut.submitToRenVM();
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
