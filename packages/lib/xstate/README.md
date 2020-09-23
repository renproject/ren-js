# 🤖 @renproject/xstate
This implements RenVM transaction lifecycles in xstate statemachines to allow developers to easily trace the state of a transaction, and explicitly know which cases they should handle during processing.

The aim is to provide a declarative interface, that can accept serializable "transaction" objects, that will reactively process the appropriate stages in the transaction lifecycle.

## Differences between renjs and @renproject/xstate

|                           | renjs | @renproject/xstate |
| ------------------------- | ----- | ------------------ |
| reactive                  | ❌    | ✓                  |
| serializable transactions | ❌    | ✓                  |
| finite, explicit states   | ❌    | ✓                  |

## Concepts
In order to make full use of this library, it is valuable to understand the [concepts behind xstate](https://xstate.js.org/docs/about/concepts.html#finite-state-machines)

At a high level, this package provides 
* `mintMachine` - a machine for instanciating a gateway addres and listening for deposits.
* `depositMachine` - a machine for processing the lifecycle of a gateway deposit, all the way from where it has been detected on the source chain, until it has been confirmed at the destination chain.
* `burnMachine` - a machine for processing burn and release transactions.

As well as a standard serializable schema for persisting and restoring transactions,  `GatewaySession`

## Usage
In order to mint or burn, all the developer needs to do is to import the appropriate machine for for the desired flow, provide the neccessary dependencies via the machine context, and run the machine via the appropriate interpreter for their application (eg `@xstate/react` for `react` appliactions).

Each machine requires
* `tx` - transaction parameters 
* `sdk` - the `RenJS` sdk instanciated for the appropriate network
* `providers` - Blockchain wallet providers for signing and sending transactions for desired networks
* `fromChainMap` - A mapping of source networks to builders for their `@renproject/chains` parameters 
* `toChainMap` - A mapping of destination networks to builders for their `@renproject/chains` parameters

### Bare xstate
Minting
```typescript
import { Machine, interpret } from "xstate";
import { mintMachine, mintConfig } from "@renproject/xstate";
import {
  Bitcoin,
  BinanceSmartChain,
  Ethereum,
  Zcash,
  BitcoinCash,
} from "@renproject/chains";
import RenJS from "@renproject/ren";

const mintTransaction = {
    id: "a unique identifier",
    type: "mint",
    network: "testnet",
    sourceAsset: "btc",
    sourceNetwork: "bitcoin",
    destAddress: "address to mint to",
    destAsset: "renBTC",
    destNetwork: "ethereum",
    destConfsTarget: 6,
    targetAmount: 1,
    userAddress: "address that will sign the transaction",
    expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
    transactions: {},
};

// A mapping of how to construct parameters for host chains,
// based on the destination network
const toChainMap = {
    binanceSmartChain: (context) => {
        const { destAddress, destNetwork } = context.tx;
        const { providers } = context;
        return new BinanceSmartChain(providers[destNetwork]).Account({
            address: destAddress,
        });
    },
    ethereum: (context) => {
        const { destAddress, destNetwork } = context.tx;
        const { providers } = context;

        return Ethereum(providers[destNetwork]).Account({
            address: destAddress,
        });
    },
};

// A mapping of how to construct parameters for source chains,
// based on the source network
const fromChainMap = {
    bitcoin: () => Bitcoin(),
    zcash: () => Zcash(),
    bitcoinCash: () => BitcoinCash(),
};

const machine = mintMachine.withConfig(mintConfig).withContext({
    tx: mintTransaction,
    sdk: new RenJS("testnet"),
    providers: blockChainProviders,
    fromChainMap,
    toChainMap,
});

// Interpret the machine, and add a listener for whenever a transition occurs.
// The machine will detect which state the transaction should be in,
// and perform the neccessary next actions
const service = interpret(machine).onTransition((state) => {
    console.log(state.value);
    if(state.value === 'requestingSignature') {
    // implement logic to determine whether deposit is valid and should be signed
    // then call 
    service.send('SIGN')
    }
});

// Start the service
service.start();
```
