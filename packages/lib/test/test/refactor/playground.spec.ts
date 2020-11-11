/* eslint-disable no-console */

import * as Chains from "@renproject/chains";

import { LogLevel, RenNetwork, SimpleLogger } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import {
    extractError,
    Ox,
    retryNTimes,
    SECONDS,
    sleep,
} from "@renproject/utils";
import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";
import { config as loadDotEnv } from "dotenv";
import { DepositStatus } from "@renproject/ren/build/main/lockAndMint";
import { expect } from "earljs";

chai.should();

loadDotEnv();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

const colors = [green, magenta, yellow, cyan, blue, red];

describe("Playground", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    longIt("mint", async function() {
        this.timeout(100000000000);

        const from = Chains.Bitcoin();
        const asset = from.asset;
        // const from = Bitcoin();
        // const asset = "BTC";
        const faucetSupported =
            ["BTC", "ZEC", "BCH", "ETH"].indexOf(asset) >= 0;

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });

        // const network = renNetworkToEthereumNetwork(NETWORK as RenNetwork);

        const infuraURL = `${Chains.renTestnet.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const logLevel = LogLevel.Log;
        const renJS = new RenJS(RenNetwork.Testnet, { logLevel });
        // const renJS = new RenJS("testnet")

        // Use 0.0001 more than fee.
        let suggestedAmount: number;
        try {
            const fees = await renJS.getFees();
            const fee: number = fees[asset.toLowerCase()].lock;
            suggestedAmount = Math.floor(fee + 0.0001 * 1e8);
        } catch (error) {
            console.error("Error fetching fees:", red(extractError(error)));
            suggestedAmount = 0.0015 * 1e8;
        }

        const lockAndMint = await renJS.lockAndMint({
            asset,
            from,
            to: Chains.Ethereum(provider, Chains.renTestnet).Account({
                address: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B",
            }),

            nonce: Ox("00".repeat(32)),
        });

        console.info(
            `Deposit ${blue(asset)} to ${blue(
                JSON.stringify(lockAndMint.gatewayAddress, null, "    "),
            )}`,
        );

        // lockAndMint
        //     .processDeposit({
        //         transaction: {
        //             cid:
        //                 "bafy2bzacedvu74e7ohjcwlh4fbx7ddf6li42fiuosajob6metcj2qwkgkgof2",
        //             to: "t1v2ftlxhedyoijv7uqgxfygiziaqz23lgkvks77i",
        //             amount: (0.01 * 1e8).toString(),
        //             params: "EzGbvVHf8lb0v8CUfjh8y+tLbZzfIFcnNnt/gh6axmw=",
        //             confirmations: 1,
        //             nonce: 7,
        //         },
        //         amount: (0.01 * 1e8).toString(),
        //     })
        //     .catch(console.error);

        if (faucetSupported) {
            console.log(
                `${blue("[faucet]")} ${blue(asset)} balance is ${blue(
                    await account.balanceOf(asset),
                )} ${blue(asset)} (${blue(await account.address(asset))})`,
            );
        }

        await new Promise((resolve, reject) => {
            let i = 0;

            lockAndMint.on("deposit", (deposit) => {
                (async () => {
                    const hash = deposit.txHash();

                    // if (deposit.depositDetails.amount === "80000") {
                    //     return;
                    // }

                    const color = colors[i];
                    i += 1;

                    deposit._state.logger = new SimpleLogger(
                        logLevel,
                        color(`[${hash.slice(0, 6)}] `),
                    );

                    const info = deposit._state.logger.log;

                    info(
                        `Received ${
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (deposit.depositDetails as any).amount / 1e8
                        } ${asset}`,
                        deposit.depositDetails,
                    );

                    const retries = 10;

                    await retryNTimes(
                        async () => {
                            deposit._state.logger.log(`Calling .confirmed`);
                            await deposit
                                .confirmed()
                                .on("confirmation", (confs, target) => {
                                    deposit._state.logger.log(
                                        `${confs}/${target} confirmations`,
                                    );
                                });
                        },
                        retries,
                        10 * SECONDS,
                    );

                    expect(deposit.status).toEqual(DepositStatus.Confirmed);

                    await retryNTimes(
                        async () => {
                            deposit._state.logger.log(`Calling .signed`);
                            await deposit.signed().on("status", (status) => {
                                deposit._state.logger.log(`status: ${status}`);
                            });
                        },
                        retries,
                        10 * SECONDS,
                    );

                    expect(deposit.status).toEqual(DepositStatus.Signed);

                    await retryNTimes(
                        async () => {
                            deposit._state.logger.log(`Calling .mint`);
                            await deposit
                                .mint({
                                    _extraMsg: "test", // Override value.
                                })
                                .on("transactionHash", (txHash) => {
                                    deposit._state.logger.log(
                                        `txHash: ${String(txHash)}`,
                                    );
                                });
                        },
                        retries,
                        10 * SECONDS,
                    );

                    expect(deposit.status).toEqual(DepositStatus.Submitted);

                    resolve();
                })().catch(console.error);
            });

            sleep(20 * SECONDS)
                .then(() => {
                    // If there's been no deposits, send one.
                    if (
                        faucetSupported &&
                        typeof lockAndMint.gatewayAddress === "string" &&
                        i === 0
                    ) {
                        console.log(
                            `${blue("[faucet]")} Sending ${blue(
                                suggestedAmount / 1e8,
                            )} ${blue(asset)} to ${blue(
                                lockAndMint.gatewayAddress,
                            )}`,
                        );
                        account
                            .sendSats(
                                lockAndMint.gatewayAddress,
                                suggestedAmount,
                                asset,
                            )
                            .catch(reject);
                    }
                })
                .catch(console.error);
        });
    });
});
