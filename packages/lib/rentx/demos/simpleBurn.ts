import { interpret } from "xstate";
import { burnMachine, GatewaySession, GatewayMachineContext } from "../"; //"@renproject/rentx";
import RenJS from "@renproject/ren";
import { Ethereum } from "@renproject/chains-ethereum";
import { Bitcoin } from "@renproject/chains-bitcoin";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";

const MNEMONIC = process.env.MNEMONIC;
const INFURA_URL = process.env.INFURA_URL;
const ethProvider = new HDWalletProvider(MNEMONIC, INFURA_URL, 0, 10);
const web3 = new Web3(ethProvider);

// Allow for an existing tx to be passed in via CLI
let parsedTx: GatewaySession;
if (process.argv[2]) {
    parsedTx = JSON.parse(process.argv[2]);
}

const burnTransaction: GatewaySession = parsedTx || {
    id: "a unique identifier",
    type: "burn",
    network: "testnet",
    sourceAsset: "btc",
    sourceNetwork: "ethereum",
    destAddress: "bitcoin address that will receive assets",
    destNetwork: "bitcoin",
    targetAmount: 0.001,
    userAddress: "address that will sign the transaction",
    expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
    transactions: {},
    customParams: {},
};

// A mapping of how to construct parameters for host chains,
// based on the destination network
export const fromChainMap = {
    ethereum: (context: GatewayMachineContext) => {
        const { destAddress, sourceNetwork, suggestedAmount } = context.tx;
        const { providers } = context;

        return Ethereum(providers[sourceNetwork]).Account({
            address: destAddress,
            value: suggestedAmount,
        });
    },
} as any;

// A mapping of how to construct parameters for source chains,
// based on the source network
export const toChainMap = {
    bitcoin: (context: GatewayMachineContext) =>
        Bitcoin().Address(context.tx.destAddress),
} as any;

const blockchainProviders = {
    ethereum: ethProvider,
};

web3.eth
    .getAccounts()
    .then((accounts) => {
        burnTransaction.destAddress =
            "tb1qryn92xs8gxwhwcnf95rgyy5388tav6quex9pvh";
        burnTransaction.userAddress = accounts[0];
        const machine = burnMachine.withContext({
            tx: burnTransaction,
            sdk: new RenJS("testnet"),
            providers: blockchainProviders,
            fromChainMap,
            toChainMap,
        });

        // Interpret the machine, and add a listener for whenever a transition occurs.
        // The machine will detect which state the transaction should be in,
        // and perform the neccessary next actions
        const service = interpret(machine).onTransition((state) => {
            console.log(state.value);
            console.log(state.context.tx);
            const burnTx = Object.values(
                state.context.tx.transactions || {},
            )[0];
            if (burnTx?.destTxHash) {
                // If we have a destination txHash, we have successfully released BTC
                console.log(
                    "Your BTC has been released! TxHash",
                    burnTx.destTxHash,
                );
                service.stop();
            }
        });

        // Start the service
        service.start();
    })
    .catch(console.error);
