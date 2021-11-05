/* eslint-disable no-console */

import { blue, cyan, green, magenta, red, yellow } from "chalk";
import { config as loadDotEnv } from "dotenv";

import {
    Ethereum,
    EthProviderCompat,
    renTestnet,
} from "@renproject/chains-ethereum";
import { Filecoin } from "@renproject/chains-filecoin";
import RenJS from "@renproject/ren";
import {
    LogLevel,
    RenNetwork,
    SECONDS,
    SimpleLogger,
    tryNTimes,
} from "@renproject/utils";
import HDWalletProvider from "@truffle/hdwallet-provider";

// Load environment variables.
loadDotEnv();
const MNEMONIC = process.env.MNEMONIC;

const logLevel = LogLevel.Log;

const main = async () => {
    const renJS = new RenJS(RenNetwork.Testnet, { logLevel });

    // Initialize Ethereum provider.
    const network = renTestnet;
    const infuraURL = network.rpcUrl({
        infura: process.env.INFURA_KEY,
    });
    const provider: EthProviderCompat = new HDWalletProvider({
        mnemonic: MNEMONIC || "",
        providerOrUrl: infuraURL,
        addressIndex: 0,
        numberOfAddresses: 10,
    });

    const lockAndMint = await renJS.lockAndMint({
        asset: "FIL",
        from: Filecoin(),
        to: Ethereum(provider, renTestnet).Account({
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

            const info = deposit._state.logger.debug;

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

            await tryNTimes(
                async () => {
                    deposit._state.logger.debug(`Calling .confirmed`);
                    await deposit
                        .confirmed()
                        .on("confirmation", (confs, target) => {
                            deposit._state.logger.debug(
                                `${confs}/${target} confirmations`,
                            );
                        });
                },
                retries,
                // Time between retries.
                10 * SECONDS,
            );

            info(`status:`, deposit.status); // DepositStatus.Confirmed

            await tryNTimes(
                async () => {
                    deposit._state.logger.debug(`Calling .signed`);
                    await deposit.signed().on("status", (status) => {
                        deposit._state.logger.debug(`status: ${status}`);
                    });
                },
                retries,
                10 * SECONDS,
            );

            info(`status:`, deposit.status); // DepositStatus.Signed

            await tryNTimes(
                async () => {
                    deposit._state.logger.debug(`Calling .mint`);
                    await deposit
                        .mint({
                            _extraMsg: "test", // Override value.
                        })
                        .on("transactionHash", (txHash) => {
                            deposit._state.logger.debug(
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
