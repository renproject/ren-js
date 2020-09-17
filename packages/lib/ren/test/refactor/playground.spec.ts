// tslint:disable: no-console

import { Bitcoin, Dogecoin, Ethereum } from "@renproject/chains";
import { LogLevel, SimpleLogger } from "@renproject/interfaces";
import { renRinkeby } from "@renproject/networks";
import {
    HttpProvider,
    OverwriteProvider,
    Provider,
} from "@renproject/provider";
import { AbstractRenVMProvider } from "@renproject/rpc";
import {
    RenVMParams,
    RenVMProvider,
    RenVMProviderInterface,
    RenVMResponses,
} from "@renproject/rpc/src/v2";
import { extractError, Ox, SECONDS, sleep } from "@renproject/utils";
import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";

import RenJS from "../../src/index";

chai.should();

require("dotenv").config();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

const colors = [green, magenta, yellow, cyan, blue, red];

describe("Refactor", () => {
    it("playground", async function () {
        this.timeout(100000000000);

        const from = Dogecoin();
        const asset = from._asset;
        const faucetSupported =
            ["BTC", "ZEC", "BCH", "ETH"].indexOf(asset) >= 0;

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });

        // const network = renNetworkToEthereumNetwork(NETWORK as RenNetwork);

        const infuraURL = `${renRinkeby.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const httpProvider = new HttpProvider<RenVMParams, RenVMResponses>(
            // tslint:disable-next-line: no-http-string
            // "https://lightnode-new-testnet.herokuapp.com/",
            "http://34.239.188.210:18515"
        ) as Provider<RenVMParams, RenVMResponses>;
        const rpcProvider = new OverwriteProvider<RenVMParams, RenVMResponses>(
            // "https://lightnode-new-testnet.herokuapp.com/",
            httpProvider,
            {
                // tslint:disable-next-line: no-object-literal-type-assertion
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
                                {
                                    asset: "DOGE",
                                    hosts: ["Ethereum"],
                                    locked: "0",
                                    origin: "Doge",
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
                } as RenVMResponses["ren_queryShards"],
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
            asset,
            from,
            to: Ethereum(provider, undefined, renRinkeby).Account({
                address: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66",
            }),

            nonce: Ox("20".repeat(32)),
        });

        console.info(
            `Deposit ${blue(asset)} to ${blue(lockAndMint.gatewayAddress)}`
        );

        if (faucetSupported) {
            console.log(
                `${blue("[faucet]")} ${blue(asset)} balance is ${blue(
                    await account.balanceOf(asset)
                )} ${blue(asset)} (${blue(await account.address(asset))})`
            );
        }

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
                    if (faucetSupported && i === 0) {
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