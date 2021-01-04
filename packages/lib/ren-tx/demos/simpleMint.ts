import { interpret } from "xstate";
import {
    mintMachine,
    mintConfig,
    GatewaySession,
    GatewayMachineContext,
} from "../src"; //"@renproject/rentx";
import RenJS from "@renproject/ren";
import { BinanceSmartChain, Ethereum } from "@renproject/chains-ethereum";
import { Bitcoin, BitcoinCash, Zcash } from "@renproject/chains-bitcoin";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";
import BigNumber from "bignumber.js";
import { config } from "dotenv";
import { RenVMProvider } from "@renproject/rpc/build/main/v2";
config();

const MNEMONIC = process.env.MNEMONIC;
const INFURA_URL = process.env.INFURA_URL;
const ethProvider = new HDWalletProvider(MNEMONIC, INFURA_URL, 0, 10);
const web3 = new Web3(ethProvider);

// Allow for an existing tx to be passed in via CLI
let parsedTx: GatewaySession;
//     =
// {
//     "id": "tx-3369601319235591",
//     "type": "mint",
//     "network": "testnet",
//     "sourceAsset": "btc",
//     "sourceChain": "bitcoin",
//     "destAddress": "0x8918e0a92ddc6b53bd1fce1ca913ce2afe8c02d2",
//     "destChain": "ethereum",
//     "targetAmount": 0.001,
//     "userAddress": "0x8918e0a92ddc6b53bd1fce1ca913ce2afe8c02d2",
//     "expiryTime": 1607500798200,
//     "transactions": {
//         "fC8FhISFgwCkDCw5SumejYhdXZAavG/2ucX+kGyOifE=": {
//             "sourceTxHash": "fC8FhISFgwCkDCw5SumejYhdXZAavG/2ucX+kGyOifE=",
//             "sourceTxAmount": 200000,
//             "sourceTxConfs": 2,
//             "rawSourceTx": {
//                 "transaction": {
//                     "txHash": "d3a1d0b5219222d6fd47e9229f6482521989c820b5a002d47b6d3a6b349bb540",
//                     "amount": 200000,
//                     "vOut": 0,
//                     "confirmations": 0
//                 },
//                 "amount": "200000"
//             },
//             "sourceTxConfTarget": 2
//         }
//     },
//     "customParams": {},
//     "nonce": "f579c62c2808e4c8c0d72effdc96a0003e97272f6fe8385f14c7558ad6c0e26e",
//     "suggestedAmount": "100000",
//     "gatewayAddress": "2N44ZHS7Q4AXyAuzeADJ25tMBfabVgssoSY"
// };
//

// v1-v2
// parsedTx = { "id": "a unique identifier", "type": "mint", "network": "testnet", "sourceAsset": "btc", "sourceChain": "bitcoin", "destAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "destChain": "ethereum", "targetAmount": 0.001, "userAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "expiryTime": 1607581043639, "transactions": { "jhG/fOsrE4NY/OfUN1oYzWi0tQVdQM+PSdDT+HD/EDo=": { "sourceTxHash": "jhG/fOsrE4NY/OfUN1oYzWi0tQVdQM+PSdDT+HD/EDo=", "sourceTxAmount": 200000, "sourceTxConfs": 0, "rawSourceTx": { "transaction": { "txHash": "8bfe4e983edcfc838facc8bc80386466e47ca51e8b75e1ace421681ac78e5a32", "amount": 200000, "vOut": 0, "confirmations": 0 }, "amount": "200000" } } }, "customParams": {}, "nonce": "1e71dd35f7208711392010417c55570ea058d4f3a501c98f00817ec66d1858d0", "suggestedAmount": "100000", "gatewayAddress": "2N8DsYjLQgartGLgeHL98GNPLmnB6U3CnEk" }

// v2 native
// parsedTx = { "id": "a unique identifier", "type": "mint", "network": "testnet", "sourceAsset": "btc", "sourceChain": "bitcoin", "destAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "destChain": "ethereum", "targetAmount": 0.001, "userAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "expiryTime": 1607584461749, "transactions": { "E0-gaNwucjwFGsop8utVEeUKl6_DGe_S6_Hh9SAkec0": { "sourceTxHash": "E0-gaNwucjwFGsop8utVEeUKl6_DGe_S6_Hh9SAkec0", "sourceTxAmount": 200000, "sourceTxConfs": 0, "rawSourceTx": { "transaction": { "txHash": "afc02bccf679c0afb061de53b561a17ff74923f1e2d386453fb657155907b6c4", "amount": 200000, "vOut": 0, "confirmations": 0 }, "amount": "200000" } } }, "customParams": {}, "nonce": "0a0e90cb8f3b758f388570d7beafa73b5b89d0d0b5f70f20df34fb8442ac293b", "suggestedAmount": "100000", "gatewayAddress": "2MvZ8aeaFwzmGomBStrTf4zWRUa9iRBXGyN" }
// parsedTx = { "id": "a unique identifier", "type": "mint", "network": "testnet", "sourceAsset": "btc", "sourceChain": "bitcoin", "destAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "destChain": "ethereum", "targetAmount": 0.001, "userAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "expiryTime": 1607653942874, "transactions": {}, "customParams": {}, "nonce": "112c6045c61c2b0511ba22a8a295a52558a9fbee9ffe219213b1be49f9194012", "suggestedAmount": "100000", "gatewayAddress": "2MyDzRiszp4Gu7udxqN9ezEb6qkxppso8DA" }
// Found out txhash is mismatched
// parsedTx = { "id": "a unique identifier", "type": "mint", "network": "testnet", "sourceAsset": "btc", "sourceChain": "bitcoin", "destAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "destChain": "ethereum", "targetAmount": 0.001, "userAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "expiryTime": 1607740710786, "transactions": { "e8jfy+FkUSmdgh4/09fYuL0tjURaQj5WtWwiI9y1zrg=": { "sourceTxHash": "e8jfy+FkUSmdgh4/09fYuL0tjURaQj5WtWwiI9y1zrg=", "sourceTxAmount": 200000, "sourceTxConfs": 0, "rawSourceTx": { "transaction": { "txHash": "20e35851814f711ff35f49471a0cf2612e1b8725849893dc4a8bfff00d2ad703", "amount": 200000, "vOut": 0, "confirmations": 0 }, "amount": "200000" } } }, "customParams": {}, "nonce": "5ff1275c9b9083b30c2b11b4c3627f95feba8857655f7c31c825b202623503e5", "suggestedAmount": "100000", "gatewayAddress": "2N5MTGKgtWcUYbwiEimqkyCn68yrEr1o2Xr" }

// can't use it because we need to cache the utxo in redis
// parsedTx = { "id": "a unique identifier", "type": "mint", "network": "testnet", "sourceAsset": "btc", "sourceChain": "bitcoin", "destAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "destChain": "ethereum", "targetAmount": 0.001, "userAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "expiryTime": 1607756617685, "transactions": {}, "customParams": {}, "nonce": "c0f341ac1e546684bdd990d632e05589457eecba7e08752c0d6ad882cfe2d8f1", "suggestedAmount": "100000", "gatewayAddress": "2N1YPZDczmzYbgM8qofB8uUc299ncEwToXv" }

// parsedTx = { "id": "a unique identifier", "type": "mint", "network": "testnet", "sourceAsset": "btc", "sourceChain": "bitcoin", "destAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "destChain": "ethereum", "targetAmount": 0.001, "userAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "expiryTime": 1607775371614, "transactions": { "i0zrCd/mPrxT2ohkLI6oCzp843zmMSftmQ8OaMDvOFc=": { "sourceTxHash": "i0zrCd/mPrxT2ohkLI6oCzp843zmMSftmQ8OaMDvOFc=", "sourceTxAmount": 200000, "sourceTxConfs": 0, "rawSourceTx": { "transaction": { "txHash": "b2f0e0628b4456f7d4dd987aef199748580bd92cd0947dacdb3bd07988a2dad2", "amount": 200000, "vOut": 0, "confirmations": 0 }, "amount": "200000" } } }, "customParams": {}, "nonce": "b88e6468fa435fce4fb71956e124db3c2265dc88629c84a4626be12051eff16c", "suggestedAmount": "100000", "gatewayAddress": "2N8fxEM2hVCo5wcTtjbrobYqz1eATaLDvvN" }

// parsedTx = { "id": "a unique identifier", "type": "mint", "network": "testnet", "sourceAsset": "btc", "sourceChain": "bitcoin", "destAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "destChain": "ethereum", "targetAmount": 0.001, "userAddress": "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434", "expiryTime": 1608692491597, "transactions": { "DOYuFN9pAa5KoqWxJTCIt-ExotP3-kI-1zoOq1YhNO4": { "sourceTxHash": "DOYuFN9pAa5KoqWxJTCIt-ExotP3-kI-1zoOq1YhNO4", "sourceTxAmount": 200000, "sourceTxConfs": 0, "rawSourceTx": { "transaction": { "txHash": "38fbf7fa7e83979f1c0a887b6970ac53f0060e5b92ef3687b3a7fdf18b860ab7", "amount": 200000, "vOut": 0, "confirmations": 0 }, "amount": "200000" } } }, "customParams": {}, "nonce": "e6d8a051afacecf45fbd6ed26572fc5c403de4ef999123c83f7f14bf2fd4abcb", "suggestedAmount": "100000", "gatewayAddress": "2Mv3rMea9qrtZ8fbf9Zv2A5wMwHqwKBG3sn" }

if (process.argv[2]) {
    parsedTx = JSON.parse(process.argv[2]);
}

const mintTransaction: GatewaySession = parsedTx || {
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
} as any;

// A mapping of how to construct parameters for source chains,
// based on the source network
export const fromChainMap = {
    bitcoin: () => Bitcoin(),
    zcash: () => Zcash(),
    bitcoinCash: () => BitcoinCash(),
} as any;

const blockchainProviders = {
    ethereum: ethProvider,
};

const LOCAL = false;

web3.eth
    .getAccounts()
    .then((accounts) => {
        mintTransaction.destAddress = accounts[0];
        mintTransaction.userAddress = accounts[0];
        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: mintTransaction,
            sdk: new RenJS(
                new RenVMProvider({
                    name: "testnet",
                    lightnode: LOCAL
                        ? "http://localhost:5000"
                        : "https://lightnode-new-testnet.herokuapp.com",
                    isTestnet: true,
                }),
                {
                    logLevel: "debug",
                    logger: console,
                },
            ),
            providers: blockchainProviders,
            fromChainMap,
            toChainMap,
        });

        // Interpret the machine, and add a listener for whenever a transition occurs.
        // The machine will detect which state the transaction should be in,
        // and perform the neccessary next actions
        let promptedGatewayAddress = false;
        let detectedDeposit = false;
        const service = interpret(machine).onTransition((state) => {
            console.log(state.context.tx);
            if (!promptedGatewayAddress && state.context.tx.gatewayAddress) {
                console.log(
                    "Please deposit",
                    new BigNumber(state.context.tx.suggestedAmount)
                        .div(1e8)
                        .toFixed(),
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

            if (!detectedDeposit && deposit) {
                console.log("Detected deposit");
                console.log(
                    "Restore with this object",
                    JSON.stringify(state.context.tx),
                );
                detectedDeposit = true;
            }

            if (state.value === "requestingSignature") {
                // implement logic to determine whether deposit is valid
                // In our case we take the first deposit to be the correct one
                // and immediately sign
                console.log("Signing transaction");
                service.send("SIGN");
            }

            if (deposit?.destTxHash) {
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
