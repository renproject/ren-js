import { Machine, interpret } from "xstate";
import { mintMachine, mintConfig } from "@renproject/xstate";
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
export const toChainMap = {
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
export const fromChainMap = {
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
});

// Start the service
service.start();
