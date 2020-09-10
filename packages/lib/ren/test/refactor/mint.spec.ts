// tslint:disable: no-console

import { BinanceSmartChain, Bitcoin, Ethereum } from "@renproject/chains";
import { renBscTestnet, renTestnet } from "@renproject/networks";
import { OverwriteProvider, Provider } from "@renproject/provider";
import { AbstractRenVMProvider } from "@renproject/rpc";
// import {
//     RenVMParams,
//     RenVMProvider,
//     RenVMProviderInterface,
//     RenVMResponses,
// } from "@renproject/rpc/build/main/v2";
import { Ox, SECONDS, sleep } from "@renproject/utils";
import chai from "chai";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";
import {
    RenVMParams,
    RenVMProvider,
    RenVMProviderInterface,
    RenVMResponses,
} from "@renproject/rpc/build/main/v2";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import { LogLevel, RenNetwork, SimpleLogger } from "@renproject/interfaces";

import RenJS from "../../src/index";

chai.should();

require("dotenv").config();

const colors = [green, magenta, yellow, cyan, blue, red];

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

describe("Refactor", () => {
    it("mint to contract", async function () {
        this.timeout(100000000000);

        const asset = "BTC";

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });

        // const network = renNetworkToEthereumNetwork(NETWORK as RenNetwork);

        const infuraURL = `${renTestnet.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        // const rpcProvider = new OverwriteProvider<RenVMParams, RenVMResponses>(
        //     "https://lightnode-new-testnet.herokuapp.com/",
        //     {
        //         ren_queryShards: {
        //             shards: [
        //                 {
        //                     darknodesRootHash:
        //                         "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        //                     gateways: [
        //                         {
        //                             asset: "BTC",
        //                             hosts: ["Ethereum"],
        //                             locked: "0",
        //                             origin: "Bitcoin",
        //                             pubKey:
        //                                 "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
        //                         },
        //                         {
        //                             asset: "ZEC",
        //                             hosts: ["Ethereum"],
        //                             locked: "0",
        //                             origin: "Zcash",
        //                             pubKey:
        //                                 "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
        //                         },
        //                         {
        //                             asset: "BCH",
        //                             hosts: ["Ethereum"],
        //                             locked: "0",
        //                             origin: "BitcoinCash",
        //                             pubKey:
        //                                 "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
        //                         },
        //                     ],
        //                     gatewaysRootHash:
        //                         "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        //                     primary: true,
        //                     pubKey:
        //                         "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
        //                 },
        //             ],
        //         },
        //     }
        // ) as RenVMProviderInterface;

        // const renVMProvider = new RenVMProvider(
        //     "testnet",
        //     rpcProvider
        // ) as AbstractRenVMProvider;

        const logLevel: LogLevel = LogLevel.Trace;

        // const renJS = new RenJS(renVMProvider, { logLevel });
        const renJS = new RenJS("testnet", { logLevel });

        // Use 0.0001 more than fee.
        let suggestedAmount;
        try {
            const fees = await renJS.getFees();
            suggestedAmount = Math.floor(
                fees[asset.toLowerCase()].lock + 0.0001 * 1e8
            );
        } catch (error) {
            console.error(error);
            suggestedAmount = 0.0008 * 1e8;
        }

        const lockAndMint = await renJS.lockAndMint({
            // Amount of BTC we are sending (in Satoshis)
            suggestedAmount: 80000,

            asset,
            from: Bitcoin(),
            to: Ethereum(provider).Contract({
                sendTo: "0x7BfBB055d4a07468a6D09E498608B41201F19Bd8",
                contractFn: "mint",
                contractParams: [
                    {
                        name: "_symbol",
                        type: "string",
                        value: "BTC",
                    },
                    {
                        name: "_address",
                        type: "address",
                        value: "0xEA8b2fF0d7f546AFAeAE1771306736357dEFa434",
                    },
                ],
                // address: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66",
            }),

            nonce: Ox("00".repeat(32)),
        });

        console.info("gateway address:", lockAndMint.gatewayAddress);

        console.log(
            `${asset} balance: ${await account.balanceOf(
                asset
            )} ${asset} (${await account.address(asset)})`
        );

        // await lockAndMint.processTransaction({
        //     txHash:
        //         "a356f6f886624d7ea3ea00cdf270b1936c48732fb9a113b6f021914c044c150e",
        //     amount: 80000,
        //     vOut: 0,
        //     confirmations: 0,
        // });

        await new Promise((resolve, reject) => {
            let i = 0;

            lockAndMint.on("deposit", async (deposit) => {
                const hash = await deposit.txHash();

                const color = colors[i];
                i += 1;

                deposit.logger = new SimpleLogger(
                    logLevel,
                    color(`[${hash.slice(0, 6)}] `)
                );

                const info = deposit.logger.log;

                info(
                    `Received ${
                        // tslint:disable-next-line: no-any
                        (deposit.deposit as any).amount / 1e8
                    } ${asset}`,
                    deposit.deposit
                );

                info(`Calling .confirmed`);
                await deposit
                    .confirmed()
                    .on("confirmation", (confs, target) => {
                        info(`${confs}/${target} confirmations`);
                    });

                info(`Calling .signed`);
                await deposit.signed().on("status", (status) => {
                    info(`status: ${status}`);
                });

                info(`Calling .mint`);
                await deposit.mint().on("transactionHash", (txHash) => {
                    info(`txHash: ${txHash}`);
                });

                resolve();
            });

            sleep(10 * SECONDS)
                .then(() => {
                    // If there's been no deposits, send one.
                    if (i === 0) {
                        console.log(
                            `${blue("[faucet]")} Sending ${blue(
                                suggestedAmount / 1e8
                            )} ${blue(asset)} to ${blue(
                                lockAndMint.gatewayAddress
                            )}`
                        );
                        account
                            .sendSats(
                                lockAndMint.gatewayAddress,
                                suggestedAmount,
                                asset
                            )
                            .catch(reject);
                    }
                })
                .catch(console.error);
        });
    });
});
