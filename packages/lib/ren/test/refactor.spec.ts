// tslint:disable: no-console

import { BinanceSmartChain, Bitcoin, Ethereum } from "@renproject/chains";
import { renBscTestnet, renTestnet } from "@renproject/networks";
import { MultiProvider, Provider } from "@renproject/provider";
// import {
//     RenVMProvider,
//     RenVMProviderInterface,
// } from "@renproject/rpc/build/main/v1";
import { Ox } from "@renproject/utils";
import chai from "chai";
import HDWalletProvider from "truffle-hdwallet-provider";
import CryptoAccount from "send-crypto";

import RenJS from "../src/index";

chai.should();

require("dotenv").config();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

describe("RenJS initialization and exports", () => {
    it("mint", async function () {
        this.timeout(100000000000);

        const asset = "BTC";
        const from = Bitcoin();

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });

        // const network = renNetworkToEthereumNetwork(NETWORK as RenNetwork);

        const infuraURL = `${renTestnet.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        // const renVMProvider = new RenVMProvider(
        //     "testnet",
        //     // new MultiProvider(["http://localhost:8081"]) as RenVMProviderInterface
        // );

        const renJS = new RenJS("testnet"); // , { logLevel: "trace" });

        // Use 0.0001 more than fee.
        const fees = await renJS.getFees();
        const suggestedAmount = Math.floor(
            fees[asset.toLowerCase()].lock + 0.0001 * 1e8
        );

        const lockAndMint = await renJS.lockAndMint({
            // Amount of BTC we are sending (in Satoshis)
            suggestedAmount,

            asset,
            from,
            to: Ethereum(provider),

            contractCalls: [
                {
                    // The contract we want to interact with
                    // sendTo: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
                    sendTo: "0x7DDFA2e5435027f6e13Ca8Db2f32ebd5551158Bb",

                    // The name of the function we want to call
                    contractFn: "mint",

                    // Arguments expected for calling `deposit`
                    contractParams: [
                        { type: "string", name: "_symbol", value: "BTC" },
                        {
                            type: "address",
                            name: "_address",
                            value: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66",
                        },
                    ],
                },
            ],

            nonce: Ox("00".repeat(32)),
        });

        console.info("gateway address:", lockAndMint.gatewayAddress);

        console.log(
            `${asset} balance: ${await account.balanceOf(
                asset
            )} ${asset} (${await account.address(asset)})`
        );

        await new Promise((resolve, reject) => {
            lockAndMint.on("deposit", async (deposit) => {
                console.info(
                    "received deposit: ",
                    deposit.deposit,
                    await deposit.txHash()
                );

                await deposit.submit().on("status", console.log);

                await deposit.mint().on("transactionHash", console.log);

                resolve();
            });

            console.log(`Sending ${suggestedAmount / 1e8} ${asset}`);
            account
                .sendSats(lockAndMint.gatewayAddress, suggestedAmount, asset)
                .catch(reject);
        });
    });
});
