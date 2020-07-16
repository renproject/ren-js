# RenJS v2.0.0

## Introduction

The initial goal of RenJS v2 is to provide the same functionality as RenJS v1. However, it should do so in a way that makes it easy for developers to override this functionality and add new features.

This includes:

1) Provide support for new assets (e.g. BTC, ZEC, BCH)
2) Provide support for new chains (e.g. Ethereum)
3) Provide custom APIs for querying chains

## Interface

```ts

import RenJS from "@renproject/ren";
import { Bitcoin, Ethereum } from "@renproject/chains";
import Web3 from "web3";

const renJS = new RenJS(); // can also inject provider and storage
const web3 = new Web3("infura url");

const gateway = await renJS.lock({
    asset: "BTC",
    from: Bitcoin(), // can inject APIs.
    to: Ethereum(web3),
    recipient: "0x1234...",
    payload: Ethereum.ContractCall({
        fn: "functionName",
        params: [{
            name: "paramName",
            type: "bytes",
            value: "bob",
        }]
    }),
});

console.log(`Please deposit ${gateway.asset} to ${gateway.address}`);

gateway.on("deposit", deposit => {

    console.log(`Received deposit of ${deposit.value} ${deposit.asset}`);

    deposit.on("confirmation", /* do something */);

    // Triggered when signature is available from RenVM.
    deposit.on("signature", deposit.mint());
});

```