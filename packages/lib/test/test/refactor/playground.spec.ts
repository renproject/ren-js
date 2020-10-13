// tslint:disable: no-console

import {
    Bitcoin,
    Dogecoin,
    Ethereum,
    Filecoin,
    Terra,
} from "@renproject/chains";
import { LogLevel, SimpleLogger } from "@renproject/interfaces";
import { renRinkeby } from "@renproject/networks";
import {
    HttpProvider,
    OverwriteProvider,
    Provider,
} from "@renproject/provider";
import RenJS from "@renproject/ren";
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

chai.should();

require("dotenv").config();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

const colors = [green, magenta, yellow, cyan, blue, red];

describe("Plaground", () => {
    // tslint:disable-next-line: mocha-no-side-effect-code
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    // tslint:disable-next-line: mocha-no-side-effect-code
    longIt("mint", async function() {
        this.timeout(100000000000);

        const from = Filecoin();
        const asset = "FIL";
        // const from = Bitcoin();
        // const asset = "BTC";
        const faucetSupported =
            ["BTC", "ZEC", "BCH", "ETH"].indexOf(asset) >= 0;

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });

        // const network = renNetworkToEthereumNetwork(NETWORK as RenNetwork);

        const infuraURL = `${renRinkeby.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const httpProvider = new HttpProvider<RenVMParams, RenVMResponses>(
            // "https://lightnode-new-testnet.herokuapp.com/",
            // tslint:disable-next-line: no-http-string
            "http://34.239.188.210:18515",
            { verbose: true }
        ) as Provider<RenVMParams, RenVMResponses>;
        const rpcProvider = new OverwriteProvider<RenVMParams, RenVMResponses>(
            // "https://lightnode-new-testnet.herokuapp.com/",
            httpProvider
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
            suggestedAmount = 0.0015 * 1e8;
        }

        const lockAndMint = await renJS.lockAndMint({
            asset,
            from,
            to: Ethereum(provider, undefined, renRinkeby).Account({
                address: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B",
            }),

            nonce: Ox("00".repeat(32)),
        });

        console.info(
            `Deposit ${blue(asset)} to ${blue(
                JSON.stringify(lockAndMint.gatewayAddress, null, "    ")
            )}`
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
                    await account.balanceOf(asset)
                )} ${blue(asset)} (${blue(await account.address(asset))})`
            );
        }

        await new Promise((resolve, reject) => {
            let i = 0;

            lockAndMint.on("deposit", async deposit => {
                const hash = await deposit.txHash();

                // if (deposit.depositDetails.amount === "80000") {
                //     return;
                // }

                const color = colors[i];
                i += 1;

                deposit._logger = new SimpleLogger(
                    logLevel,
                    color(`[${hash.slice(0, 6)}] `)
                );

                const info = deposit._logger.log;

                info(
                    `Received ${
                        // tslint:disable-next-line: no-any
                        (deposit.depositDetails as any).amount / 1e8
                    } ${asset}`,
                    deposit.depositDetails
                );

                info(`Calling .confirmed`);
                await deposit
                    .confirmed()
                    .on("confirmation", (confs, target) => {
                        info(`${confs}/${target} confirmations`);
                    });

                let retries = 10;
                while (retries) {
                    try {
                        info(
                            retries === 10
                                ? `Calling .signed`
                                : `Retrying .signed`
                        );
                        await deposit.signed().on("status", status => {
                            info(`status: ${status}`);
                        });
                        break;
                    } catch (error) {
                        console.error(error);
                    }
                    await sleep(10);
                    retries--;
                }

                info(`Calling .mint`);
                await deposit.mint().on("transactionHash", txHash => {
                    info(`txHash: ${txHash}`);
                });

                resolve();
            });

            sleep(10 * SECONDS)
                .then(() => {
                    // If there's been no deposits, send one.
                    if (
                        faucetSupported &&
                        typeof lockAndMint.gatewayAddress === "string" &&
                        i === 0
                    ) {
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
