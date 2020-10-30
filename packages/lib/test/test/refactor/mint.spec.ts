/* eslint-disable no-console */

import * as Chains from "@renproject/chains";

import { LogLevel, SimpleLogger } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { SECONDS, sleep } from "@renproject/utils";
import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";
import { config as loadDotEnv } from "dotenv";

chai.should();

loadDotEnv();

const colors = [green, magenta, yellow, cyan, blue, red];

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

describe("Refactor: mint", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    longIt("mint to contract", async function() {
        this.timeout(100000000000);

        const asset = "BTC";

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });

        // const network = renNetworkToEthereumNetwork(NETWORK as RenNetwork);

        const infuraURL = `${Chains.renTestnet.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const logLevel: LogLevel = LogLevel.Log;

        // const renJS = new RenJS(renVMProvider, { logLevel });
        const renJS = new RenJS("testnet", { logLevel });

        // Use 0.0001 more than fee.
        let suggestedAmount;
        try {
            const fees = await renJS.getFees();
            const fee: number = fees[asset.toLowerCase()].lock;
            suggestedAmount = Math.floor(fee + 0.0001 * 1e8);
        } catch (error) {
            console.error(error);
            suggestedAmount = 0.0008 * 1e8;
        }

        const lockAndMint = await renJS.lockAndMint({
            asset,
            from: Chains.Bitcoin(),
            to: Chains.Ethereum(provider).Account({
                address: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66",
            }),
        });

        // const lockAndMint = await renJS.lockAndMint({
        //     // Amount of BTC we are sending (in Satoshis)
        //     suggestedAmount: 80000,

        //     asset,
        //     from: Bitcoin(),
        //     to: Ethereum(provider).Account({
        //         address: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66",
        //     }),

        //     nonce: Ox("20".repeat(32)),
        // });

        console.info("gateway address:", lockAndMint.gatewayAddress);

        console.log(
            `${asset} balance: ${await account.balanceOf(
                asset,
            )} ${asset} (${await account.address(asset)})`,
        );

        await new Promise((resolve, reject) => {
            let i = 0;

            // lockAndMint.on("deposit", async deposit => {

            void Promise.resolve(
                lockAndMint.processDeposit({
                    transaction: {
                        txHash:
                            "2f33d54f91f0f3ec7c50404b5155dd6699ab1f93720ba43dfe85dea70c63822c",
                        amount: 200000,
                        vOut: 0,
                        confirmations: 0,
                    },
                    amount: "200000",
                }),
            ).then(async (deposit) => {
                const hash = await deposit.txHash();

                const color = colors[i % colors.length];
                i += 1;

                deposit._logger = new SimpleLogger(
                    logLevel,
                    color(`[${hash.slice(0, 6)}] `),
                );

                const info = deposit._logger.log;

                info(
                    `Received ${
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (deposit.depositDetails as any).amount / 1e8
                    } ${asset}`,
                    deposit.depositDetails,
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
                    info(`txHash: ${String(txHash)}`);
                });

                resolve();
            });

            sleep(10 * SECONDS)
                .then(() => {
                    // If there's been no deposits, send one.
                    if (i === 0) {
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
