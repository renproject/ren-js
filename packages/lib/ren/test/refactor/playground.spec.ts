// tslint:disable: no-console

import { Bitcoin, Ethereum } from "@renproject/chains";
import { renRinkeby } from "@renproject/networks";
import { HttpProvider, OverwriteProvider } from "@renproject/provider";
import { AbstractRenVMProvider } from "@renproject/rpc";
import {
    RenVMParams,
    RenVMProvider,
    RenVMProviderInterface,
    RenVMResponses,
} from "@renproject/rpc/build/main/v2";
import { extractError, Ox } from "@renproject/utils";
import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";
import { LogLevel, SimpleLogger } from "@renproject/interfaces";

import RenJS from "../../src/index";

chai.should();

require("dotenv").config();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

const colors = [green, magenta, yellow, cyan, blue, red];

describe("Refactor", () => {
    it("playground", async function () {
        this.timeout(100000000000);

        const asset = "BTC";

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });

        // const network = renNetworkToEthereumNetwork(NETWORK as RenNetwork);

        const infuraURL = `${renRinkeby.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const httpProvider = new HttpProvider<RenVMParams, RenVMResponses>(
            // tslint:disable-next-line: no-http-string
            "http://34.239.188.210:18515"
        );
        const rpcProvider = new OverwriteProvider<RenVMParams, RenVMResponses>(
            // "https://lightnode-new-testnet.herokuapp.com/",
            httpProvider,
            {
                ren_queryShards: {
                    shards: [
                        {
                            darknodesRootHash:
                                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                            gateways: [
                                {
                                    asset: "BTC",
                                    hosts: ["Ethereum"],
                                    locked: "0",
                                    origin: "Bitcoin",
                                    pubKey:
                                        "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
                                },
                                {
                                    asset: "ZEC",
                                    hosts: ["Ethereum"],
                                    locked: "0",
                                    origin: "Zcash",
                                    pubKey:
                                        "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
                                },
                                {
                                    asset: "BCH",
                                    hosts: ["Ethereum"],
                                    locked: "0",
                                    origin: "BitcoinCash",
                                    pubKey:
                                        "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
                                },
                            ],
                            gatewaysRootHash:
                                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                            primary: true,
                            pubKey:
                                "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
                        },
                    ],
                },
            }
        ) as RenVMProviderInterface;
        const renVMProvider = new RenVMProvider(
            "testnet",
            rpcProvider
        ) as AbstractRenVMProvider;

        const logLevel = LogLevel.Log;
        const renJS = new RenJS(renVMProvider, { logLevel });
        // const renJS = new RenJS("testnet")

        // Use 0.0001 more than fee.
        let suggestedAmount;
        try {
            const fees = await renJS.getFees();
            suggestedAmount = Math.floor(
                fees[asset.toLowerCase()].lock + 0.0001 * 1e8
            );
        } catch (error) {
            console.error("Error fetching fees:", red(extractError(error)));
            suggestedAmount = 0.0008 * 1e8;
        }

        const lockAndMint = await renJS.lockAndMint({
            asset: "BTC",
            from: Bitcoin(),
            to: Ethereum(provider, undefined, renRinkeby).Account({
                address: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66",
            }),

            nonce: Ox("10".repeat(32)),
        });

        console.info(
            `Deposit ${blue(asset)} to ${blue(lockAndMint.gatewayAddress)}`
        );

        console.log(
            `${blue("[faucet]")} ${blue(asset)} balance is ${blue(
                await account.balanceOf(asset)
            )} ${blue(asset)} (${blue(await account.address(asset))})`
        );

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

                await deposit
                    .confirmed()
                    .on("confirmation", (confs, target) => {
                        info(`${confs}/${target} confirmations`);
                    });

                await deposit.signed().on("status", (status) => {
                    info(`status: ${status}`);
                });

                await deposit.mint().on("transactionHash", (txHash) => {
                    info(`txHash: ${txHash}`);
                });

                resolve();
            });

            // console.log(
            //     `${blue("[faucet]")} Sending ${blue(
            //         suggestedAmount / 1e8
            //     )} ${blue(asset)} to ${blue(lockAndMint.gatewayAddress)}`
            // );
            // account
            //     .sendSats(lockAndMint.gatewayAddress, suggestedAmount, asset)
            //     .catch(reject);
        });
    });
});
