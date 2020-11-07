# RenJS v2.0.0

## Introduction

The initial goal of RenJS v2 is to provide the same functionality as RenJS v1. However, it should do so in a way that makes it easy for developers to override this functionality and add new features.

This includes:

1. Provide support for new assets (e.g. BTC, ZEC, BCH)
2. Provide support for new chains (e.g. Ethereum)
3. Provide custom APIs for querying chains

## Interface

### Minting

```ts
import RenJS from "@renproject/ren";
import { Bitcoin, Ethereum } from "@renproject/chains";

/* or: */
// import { Bitcoin } from "@renproject/chains-bitcoin";
import Web3 from "web3";

const renJS = new RenJS(); // can inject provider and storage
const web3 = new Web3("infura url");

const gateway = await renJS.lock({
    asset: "BTC",
    from: Bitcoin(), // can inject apis
    to: Ethereum(web3).Contract({
        address: "0x1234...",
        fn: "functionName",
        params: [
            {
                name: "paramName",
                type: "bytes",
                value: "test",
            },
            {
                name: "paramName2",
                type: "bytes",
                inPayload: false,
            },
        ],
    }),
    // nonce: "01234"
    // to: Ethereum(web3).Account({
    //     address: "0x1234...",
    // }),
});

console.log(`Please deposit ${gateway.asset} to ${gateway.address}`);

gateway.on("deposit", async (deposit) => {
    console.log(`Received deposit of ${deposit.value} ${deposit.asset}`);
    deposit.on("confirmation", () =>
        console.log(`${deposit.confirmations}/6 confirmations`),
    );

    await deposit.confirmed();
    await deposit.signed();
    await deposit.mint({ paramName2: "delayed parameter value" });
});
```

### Burning

```ts
import RenJS from "@renproject/ren";
import { Bitcoin, Ethereum } from "@renproject/chains";
import Web3 from "web3";

const renJS = new RenJS(); // can inject provider and storage
const web3 = new Web3("infura url");

const gateway = await renJS.burn({
    asset: "BTC",
    from: Ethereum(web3).Contract({
        address: "0x1234...",
        fn: "functionName",
        params: [
            {
                name: "paramName",
                type: "bytes",
                value: "bob",
            },
        ],
    }),
    to: Bitcoin().Address("8m..."),
});

await gateway.release();
```
