/* eslint-disable no-console */

import { Filecoin } from "@renproject/chains-filecoin";
import { Ethereum, renTestnetVDot3 } from "@renproject/chains-ethereum";
import { LogLevel, RenNetwork, SimpleLogger } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { retryNTimes, SECONDS } from "@renproject/utils";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import HDWalletProvider from "truffle-hdwallet-provider";
import { config as loadDotEnv } from "dotenv";

// Load environment variables.
loadDotEnv();
const MNEMONIC = process.env.MNEMONIC;

const logLevel = LogLevel.Log;

const main = async () => {
    const renJS = new RenJS(RenNetwork.TestnetVDot3, { logLevel });

    // Initialize Ethereum provider.
    const infuraURL = `${renTestnetVDot3.infura}/v3/${
        process.env.INFURA_KEY || ""
    }`;
    const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

    const lockAndMint = await renJS.lockAndMint({
        asset: "FIL",
        from: Filecoin(),
        to: Ethereum(provider, renTestnetVDot3).Account({
            address: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B",
        }),
    });

    console.info(
        `Deposit ${blue("FIL")} to ${blue(
            JSON.stringify(lockAndMint.gatewayAddress, null, "    "),
        )}`,
    );

    /* It's possible to provide deposit information manually. */

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
    //     .on(deposit => { /* handle deposit, same as below */ })
    //     .catch(console.error);

    // Make it easier to tell each deposit's logs apart.
    const colors = [green, magenta, yellow, cyan, blue, red];
    let i = 0;

    /*
     * The following callback can be replaced with the following, which will
     * attempt each step of the minting indefinitely.
     * ```
     * lockAndMint.on("deposit", RenJS.defaultDepositHandler)
     * ```
     */
    lockAndMint.on("deposit", (deposit) => {
        (async () => {
            const hash = deposit.txHash();

            const color = colors[i % colors.length];
            i += 1;

            deposit._state.logger = new SimpleLogger(
                logLevel,
                color(`[${hash.slice(0, 6)}]`),
            );

            const info = deposit._state.logger.log;

            info(
                `Received ${
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (deposit.depositDetails as any).amount / 1e8
                } ${deposit.params.asset} - ${color(hash)}`,
                deposit.depositDetails,
            );

            info(`status:`, deposit.status); // DepositStatus.Detected

            // Retry each step 10 times. Set to -1 to retry-indefinitely.
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
                // Time between retries.
                10 * SECONDS,
            );

            info(`status:`, deposit.status); // DepositStatus.Confirmed

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

            info(`status:`, deposit.status); // DepositStatus.Signed

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

            info(`status:`, deposit.status); // DepositStatus.Submitted
        })().catch(console.error);
    });
};

main().catch(console.error);
