import { interpret } from "xstate";
import {
    mintMachine,
    GatewaySession,
    GatewayMachineContext,
    buildMintContextWithMap,
    isOpen,
    isAccepted,
    isCompleted,
    buildMintConfig,
    GatewayMachineEvent,
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
    providerOrUrl: INFURA_URL,
    addressIndex: 0,
    numberOfAddresses: 10,
}) as any;
const web3 = new Web3(ethProvider);
// Allow for an existing tx to be passed in via CLI
let parsedTx: GatewaySession<any>;

if (process.argv[2]) {
    parsedTx = JSON.parse(process.argv[2]);
}

// const mintTransaction: GatewaySession<any> = parsedTx || {
//     id: "a unique identifier",
//     network: "testnet",
//     sourceAsset: "btc",
//     sourceChain: "bitcoin",
//     destAddress: "ethereum address that will receive assets",
//     destChain: "ethereum",
//     userAddress: "address that will sign the transaction",
//     expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
//     transactions: {},
//     customParams: {},
// };

const mintTransaction = JSON.parse(
    `{"id":"a unique identifier","network":"testnet","sourceAsset":"btc","sourceChain":"bitcoin","destAddress":"0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434","destChain":"ethereum","userAddress":"0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434","expiryTime":1618895431076,"transactions":{"3e59ad8c7f32c4d742087b65f69cbf416fdfdf77b9a86a1bcbc5b8967369ea18":{"sourceTxHash":"3e59ad8c7f32c4d742087b65f69cbf416fdfdf77b9a86a1bcbc5b8967369ea18","renVMHash":"qOs6ySogsFls/WLn7/k5DUU2CWBBULwxQW6WjBQJxpw=","sourceTxAmount":"310000","sourceTxConfs":0,"rawSourceTx":{"transaction":{"txHash":"3e59ad8c7f32c4d742087b65f69cbf416fdfdf77b9a86a1bcbc5b8967369ea18","amount":"310000","vOut":0,"confirmations":0},"amount":"310000"},"detectedAt":1618809102845}},"customParams":{},"nonce":"2020202020202020202020202020202020202020202020202020202034393330","gatewayAddress":"2NDt7z9c7bJwyXpaYoi3yw5y948y7uQNfXa"}`,
);

// A mapping of how to construct parameters for host chains,
// based on the destination network
export const toChainMap = {
    binanceSmartChain: (context: GatewayMachineContext<any>) => {
        const { destAddress, network } = context.tx;
        // const { providers } = context;
        return new BinanceSmartChain(ethProvider, network).Account({
            address: destAddress,
        });
    },
    ethereum: (context: GatewayMachineContext<any>) => {
        const { destAddress, network } = context.tx;
        // const { providers } = context;

        return Ethereum(ethProvider, network).Account({
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

web3.eth
    .getAccounts()
    .then((accounts) => {
        mintTransaction.destAddress = accounts[0];
        mintTransaction.userAddress = accounts[0];
        const machine = mintMachine.withConfig(buildMintConfig()).withContext(
            buildMintContextWithMap({
                tx: mintTransaction,
                sdk: new RenJS("testnet"),
                fromChainMap,
                toChainMap,
            }),
        );

        // Interpret the machine, and add a listener for whenever a transition occurs.
        // The machine will detect which state the transaction should be in,
        // and perform the neccessary next actions
        let promptedGatewayAddress = false;
        let detectedDeposit = false;
        let claimed = false;
        const service = interpret<
            GatewayMachineContext<any>,
            any,
            GatewayMachineEvent<any>
        >(machine).onTransition((state) => {
            if (
                !promptedGatewayAddress &&
                isOpen(state.context.tx) &&
                state.context.tx.gatewayAddress
            ) {
                console.log(
                    "Please deposit",
                    "BTC to",
                    state.context.tx.gatewayAddress,
                );

                console.log(
                    "Restore with this object",
                    JSON.stringify(state.context.tx),
                );

                promptedGatewayAddress = true;
            }

            const deposit = Object.values(
                state.context.tx.transactions || {},
            )[0];

            if (!deposit) return;

            if (!detectedDeposit && deposit) {
                console.log("Detected deposit");
                console.log(
                    "Restore with this object",
                    JSON.stringify(state.context.tx),
                );
                detectedDeposit = true;
            }

            if (
                state.context.mintRequests.includes(deposit?.sourceTxHash) &&
                isAccepted(deposit) &&
                !claimed
            ) {
                // implement logic to determine whether deposit is valid
                // In our case we take the first deposit to be the correct one
                // and immediately sign
                console.log("Signing transaction");
                claimed = true;
                service.send({
                    type: "CLAIM",
                    data: { ...deposit, contractParams: {} },
                    params: {},
                    //hash: deposit.sourceTxHash,
                });
            }

            if (deposit && isCompleted(deposit)) {
                // If we have a destination txHash, we have successfully minted BTC
                console.log(
                    "Your BTC has been minted! TxHash",
                    deposit.destTxHash,
                );
                service.stop();
            }
        });

        // Start the service
        service.start();
    })
    .catch(console.error);
