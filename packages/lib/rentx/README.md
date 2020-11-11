# `🤖 @renproject/rentx`

This implements RenVM transaction lifecycles in [xstate](https://xstate.js.org) state-machines to allow developers to easily trace the state of a transaction, and explicitly know which cases they should handle during processing.

The aim is to provide a declarative interface, that can accept serializable "transaction" objects, that will reactively process the appropriate stages in the transaction lifecycle.

## Differences between RenJS and @renproject/rentx

|                           | renjs | @renproject/rentx |
| ------------------------- | ----- | ----------------- |
| reactive                  | ❌    | ✓                 |
| serializable transactions | ❌    | ✓                 |
| finite, explicit states   | ❌    | ✓                 |

## Concepts

In order to make full use of this library, it is valuable to understand the [concepts behind xstate](https://xstate.js.org/docs/about/concepts.html#finite-state-machines)

At a high level, this package provides

-   `mintMachine` - a machine for instantiating a gateway address and listening for deposits.
-   `depositMachine` - a machine for processing the lifecycle of a gateway deposit, all the way from where it has been detected on the source chain, until it has been confirmed at the destination chain.
-   `burnMachine` - a machine for processing burn and release transactions.

As well as a standard serializable schema for persisting and restoring transactions, `GatewaySession`

## Usage

In order to mint or burn, all the developer needs to do is to import the appropriate machine for for the desired flow, provide the necessary dependencies via the machine context, and run the machine via the appropriate interpreter for their application (eg `@xstate/react` for `react` applications).

Each machine requires

-   `tx` - transaction parameters
-   `sdk` - the `RenJS` sdk instantiated for the appropriate network
-   `providers` - Blockchain wallet providers for signing and sending transactions for desired networks
-   `fromChainMap` - A mapping of source networks to builders for their `@renproject/chains` parameters
-   `toChainMap` - A mapping of destination networks to builders for their `@renproject/chains` parameters

### Standalone xstate example

#### Minting
```typescript
import { interpret } from "xstate";
import {
    mintMachine,
    mintConfig,
    GatewaySession,
    GatewayMachineContext,
} from "../"; //"@renproject/rentx";
import RenJS from "@renproject/ren";
import { BinanceSmartChain, Ethereum } from "@renproject/chains-ethereum";
import { Bitcoin, BitcoinCash, Zcash } from "@renproject/chains-bitcoin";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";

const MNEMONIC = process.env.MNEMONIC;
const INFURA_URL = process.env.INFURA_URL;
const ethProvider = new HDWalletProvider(MNEMONIC, INFURA_URL, 0, 10);
const web3 = new Web3(ethProvider);

const mintTransaction: GatewaySession = {
    id: "a unique identifier",
    type: "mint",
    network: "testnet",
    sourceAsset: "btc",
    sourceNetwork: "bitcoin",
    destAddress: "ethereum address that will receive assets",
    destNetwork: "ethereum",
    targetAmount: 1,
    userAddress: "address that will sign the transaction",
    expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
    transactions: {},
    customParams: {},
};

// A mapping of how to construct parameters for host chains,
// based on the destination network
export const toChainMap = {
    binanceSmartChain: (context: GatewayMachineContext) => {
        const { destAddress, destNetwork } = context.tx;
        const { providers } = context;
        return new BinanceSmartChain(providers[destNetwork]).Account({
            address: destAddress,
        });
    },
    ethereum: (context: GatewayMachineContext) => {
        const { destAddress, destNetwork } = context.tx;
        const { providers } = context;
        console.log(destNetwork);

        return Ethereum(providers[destNetwork]).Account({
            address: destAddress,
        });
    },
};

// A mapping of how to construct parameters for source chains,
// based on the source network
export const fromChainMap = {
    bitcoin: () => Bitcoin(),
    zcash: () => Zcash(),
    bitcoinCash: () => BitcoinCash(),
};

const blockchainProviders = {
    ethereum: ethProvider,
};

web3.eth.getAccounts().then((accounts) => {
    mintTransaction.destAddress = accounts[0];
    mintTransaction.userAddress = accounts[0];
    const machine = mintMachine.withConfig(mintConfig).withContext({
        tx: mintTransaction,
        sdk: new RenJS("testnet"),
        providers: blockchainProviders,
        fromChainMap,
        toChainMap,
    });

    // Interpret the machine, and add a listener for whenever a transition occurs.
    // The machine will detect which state the transaction should be in,
    // and perform the neccessary next actions
    let promptedGatewayAddress = false;
    const service = interpret(machine).onTransition((state) => {
        if (!promptedGatewayAddress && state.context.tx.gatewayAddress) {
            console.log(
                "Please deposit BTC to",
                state.context.tx.gatewayAddress,
            );
            promptedGatewayAddress = true;
        }
        if (state.value === "requestingSignature") {
            // implement logic to determine whether deposit is valid
            // In our case we take the first deposit to be the correct one
            // and immediately sign
            console.log("Signing transaction");
            service.send("SIGN");
        }
        const deposit = Object.values(state.context.tx.transactions || {})[0];
        if (deposit?.destTxHash) {
            // If we have a destination txHash, we have successfully minted BTC
            console.log("Your BTC has been minted! TxHash", deposit.destTxHash);
            service.stop();
        }
    });

    // Start the service
    service.start();
});
```
