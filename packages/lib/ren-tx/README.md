# `🤖 @renproject/ren-tx`

This implements RenVM transaction lifecycles in [xstate](https://xstate.js.org) state-machines to allow developers to easily trace the state of a transaction, and explicitly know which cases they should handle during processing.

The aim is to provide a declarative interface, that can accept serializable "transaction" objects, that will reactively process the appropriate stages in the transaction lifecycle.

## Differences between RenJS and @renproject/ren-tx

|                           | renjs | @renproject/ren-tx |
| ------------------------- | ----- | ------------------ |
| reactive                  | ❌    | ✓                  |
| serializable transactions | ❌    | ✓                  |
| finite, explicit states   | ❌    | ✓                  |

## Concepts

In order to make full use of this library, it is valuable to understand the [concepts behind xstate](https://xstate.js.org/docs/about/concepts.html#finite-state-machines)

At a high level, this package provides

-   `mintMachine` - a machine for instantiating a gateway address and listening for deposits.
-   `depositMachine` - a machine for processing the lifecycle of a gateway deposit, all the way from detection on the source chain, until confirmation on the destination chain.
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

(see the `/demos` folder for complete examples)

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
import HDWalletProvider from "@truffle/hdwallet-provider";
import Web3 from "web3";
import { provider } from "web3-providers";

const MNEMONIC = process.env.MNEMONIC;
const INFURA_URL = process.env.INFURA_URL;
const ethProvider: provider = new HDWalletProvider({
    mnemonic: MNEMONIC || "",
    providerOrUrl: infuraURL,
    addressIndex: 0,
    numberOfAddresses: 10,
}) as any;
const web3 = new Web3(ethProvider);

const mintTransaction: GatewaySession = {
    id: "a unique identifier",
    type: "mint",
    network: "testnet",
    sourceAsset: "btc",
    sourceChain: "bitcoin",
    destAddress: "ethereum address that will receive assets",
    destChain: "ethereum",
    targetAmount: 0.001,
    userAddress: "address that will sign the transaction",
    expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
    transactions: {},
    customParams: {},
};

// A mapping of how to construct parameters for host chains,
// based on the destination network
export const toChainMap = {
    binanceSmartChain: (context: GatewayMachineContext) => {
        const { destAddress, destChain, network } = context.tx;
        const { providers } = context;
        return new BinanceSmartChain(providers[destChain], network).Account({
            address: destAddress,
        });
    },
    ethereum: (context: GatewayMachineContext) => {
        const { destAddress, destChain, network } = context.tx;
        const { providers } = context;

        return Ethereum(providers[destChain], network).Account({
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
    let claimed = false;
    const service = interpret(machine).onTransition((state) => {
        if (!promptedGatewayAddress && state.context.tx.gatewayAddress) {
            console.log(
                "Please deposit BTC to",
                state.context.tx.gatewayAddress,
            );
            promptedGatewayAddress = true;
        }
        const deposit = Object.values(state.context.tx.transactions || {})[0];
        if (
            state.context.mintRequests.includes(deposit.sourceTxHash) &&
            !claimed
        ) {
            // implement logic to determine whether deposit is valid
            // In our case we take the first deposit to be the correct one
            // and immediately sign
            console.log("Signing transaction");
            claimed;
            service.send({ type: "CLAIM", hash: deposit.sourceTxHash });
        }
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
