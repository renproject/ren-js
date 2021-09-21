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

Usage is described in the [Getting Started Tutorial](https://renproject.github.io/ren-client-docs/ren-js/tutorial/overview).

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

This assumes `window.ethereum` is available (e.g. in a browser with MetaMask installed).

See [hdwallet-provider](https://github.com/trufflesuite/truffle/tree/develop/packages/hdwallet-provider) and [infura.io](https://infura.io) if you are using RenJS using Node.js instead of in a browser.

```typescript
import { Bitcoin, Ethereum } from "@renproject/chains";
import RenJS from "@renproject/ren";
import ethers from "ethers";

const mint = async () => {
    await window.ethereum.enable();
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const address = await signer.getAddress();

    const lockAndMint = await new RenJS("testnet").lockAndMint({
        asset: "BTC",
        from: Bitcoin(),
        to: Ethereum(provider.provider).Address(address),
    });

    console.log(`Deposit BTC to ${lockAndMint.gatewayAddress}`);

    lockAndMint.on("deposit", RenJS.defaultDepositHandler);
};

mint().catch(console.error);
```

### Bridging BTC from Ethereum back to the Bitcoin chain

```typescript
import { Bitcoin, Ethereum } from "@renproject/chains";
import RenJS from "@renproject/ren";
import ethers from "ethers";

const burn = async () => {
    await window.ethereum.enable();
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const value = 2000000; // sats

    const burnAndRelease = await new RenJS("testnet").burnAndRelease({
        asset: "BTC",
        to: Bitcoin().Address("miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6"),
        from: Ethereum(provider.provider).Account({ value }),
    });

    await burnAndRelease.burn();
    await burnAndRelease.release();
};

burn().catch(console.error);
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
