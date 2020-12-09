# `🛠️ RenJS`

`RenJS` is the official Javascript SDK for interacting with [RenVM](https://renproject.io). See [github.com/renproject/ren-js](https://github.com/renproject/ren-js) for information.

## Installation

Install RenJS:

```sh
yarn add @renproject/ren
# Or
npm install --save @renproject/ren
```

## Usage

Usage is described in the [Getting Started Tutorial](https://docs.renproject.io/developers/tutorial/getting-started).

### RenVM network information

```ts
const RenJS = require("@renproject/ren");
const renJS = new RenJS();

// Print available methods
console.log(renJS.renVM);

// Query fees
renJS.renVM.queryFees().then(console.log);
```

### Bridging BTC to Ethereum

See [Infura](https://infura.io/) to get an Infura key.

```typescript
import { Bitcoin, Ethereum } from "@renproject/chains";
import RenJS from "@renproject/ren";

const lockAndMint = await new RenJS("testnet").lockAndMint({
    asset: "BTC",
    from: Bitcoin(),
    to: Ethereum(web3Provider).Address("0x1234..."),
});

console.log(`Deposit BTC to ${lockAndMint.gatewayAddress}`);

lockAndMint.on("deposit", async (deposit) => {
    await deposit.confirmed();
    await deposit.signed();
    await deposit.mint();
});
```

### Bridging BTC from Ethereum back to the Bitcoin chain

```typescript
const RenJS = require("@renproject/ren");
const renJS = new RenJS("testnet"); // Or "mainnet"
const web3 = new Web3("... Ethereum Kovan node or Infura ...");

const amount = 0.001;

renJS
    .burnAndRelease({
        sendToken: "BTC", // Bridge BTC from Ethereum back to Bitcoin's chain
        sendAmount: RenJS.utils.value(amount, "btc").sats(), // Amount of BTC
        sendTo: "miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6", // Recipient Bitcoin address
        web3Provider: web3.currentProvider,
    })
    .readFromEthereum()
    .then((tx) => tx.submit())
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

See [../test](../test).
