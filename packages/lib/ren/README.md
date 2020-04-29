# `🛠️ RenJS`

There's two official Javascript SDKs for interacting with [RenVM](https://renproject.io):

1. **GatewayJS** ([`gateway-js` repository](https://github.com/renproject/ren-js/tree/master/packages/lib/gateway)): The simplest way to get started, providing a full user experience.
2. **RenJS** (this repository): A lower-level SDK which can be integrated into your existing user interface.

See the [Getting Started Tutorial](https://docs.renproject.io/developers/tutorial/getting-started) to start using RenJS.

## Changelog

See the [Releases](https://github.com/renproject/ren-js/releases) page.

## About

RenJS is a Node.js and browser SDK for bridging BTC, BCH and ZEC to your project. See the following examples:

* **Decentralized *dApp***:
    * [ChaosDEX](https://github.com/renproject/chaosdex): A decentralized exchange that uses RenJS to enable depositing and withdrawing BTC, BCH and ZEC.
* **Node.js server**:
    * [Interoperability Examples](https://github.com/renproject/interoperability-examples): Examples on speeding up BTC deposits for users and providing gas
* **Command-line application**:
    * [ChaosDEX Trading Bot](https://github.com/renproject/chaosdex-trading-bot): A trading bot that automatically trades between BTC, BCH, ZEC and DAI (currently still SAI).

<br />
<hr />
<br />

## Installation

Install RenJS:

```sh
yarn add @renproject/ren
# Or
npm install --save @renproject/ren
```

## Usage

Usage is described in the [getting started tutorial](https://docs.renproject.io/developers/tutorial/getting-started).

Example of bridging BTC into Ethereum (see [Infura](https://infura.io/) for initializing Web3):

```typescript
const renJS = new RenJS("testnet"); // or "chaosnet"
const web3 = new Web3("... Ethereum Kovan node or Infura ...");

const amount = 0.001;

const lockAndMint = renJS.lockAndMint({
    sendToken: "BTC", // Bridge BTC to Ethereum
    sendAmount: RenJS.utils.value(amount, "btc").sats(), // Amount of BTC
    sendTo: "0xe520ec7e6C0D2A4f44033E2cC8ab641cb80F5176", // Recipient Ethereum address
});

const gatewayAddress = lockAndMint.addr();
console.log(`Deposit ${amount} BTC to ${gatewayAddress}`);

lockAndMint.waitAndSubmit(web3.currentProvider, 0 /* confirmations */)
    .then(console.log)
    .catch(console.error);
```

Example of bridging BTC out of Ethereum:

```typescript
const renJS = new RenJS("testnet"); // or "chaosnet"
const web3 = new Web3("... Ethereum Kovan node or Infura ...");

const amount = 0.001;

renJS.burnAndRelease({
    sendToken: "BTC", // Bridge BTC from Ethereum back to Bitcoin's chain
    sendAmount: RenJS.utils.value(amount, "btc").sats(), // Amount of BTC
    sendTo: "miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6", // Recipient Bitcoin address
    web3Provider: web3.currentProvider,
})
    .readFromEthereum()
    .then(tx => tx.submit())
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
yarn run build
# or watch, to rebuild on new changes:
yarn run watch

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
