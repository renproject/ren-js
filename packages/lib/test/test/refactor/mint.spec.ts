/* eslint-disable no-console */

import * as Chains from "@renproject/chains";

import {
    LockAndMintParams,
    LogLevel,
    SimpleLogger,
} from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { extractError, SECONDS, sleep } from "@renproject/utils";
import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";
import { config as loadDotEnv } from "dotenv";
import BigNumber from "bignumber.js";

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

        const account = new CryptoAccount(PRIVATE_KEY, {
            network: "testnet",
            apiAddress: "https://lotus-cors-proxy.herokuapp.com/",
        });

        const logLevel: LogLevel = LogLevel.Log;
        const renJS = new RenJS("testnet", { logLevel });

        const infuraURL = `${Chains.renTestnet.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const params: LockAndMintParams = {
            asset,
            from: Chains.Bitcoin(),
            to: Chains.Ethereum(provider, Chains.renTestnet).Account({
                address: "0xe520ec7e6C0D2A4f44033E2cC8ab641cb80F5176",
            }),
        };

        const assetDecimals = await params.from.assetDecimals(asset);

        // Use 0.0001 more than fee.
        let suggestedAmount: BigNumber | number;
        try {
            const fees = await renJS.getFees(params);
            suggestedAmount = fees.lock
                .div(new BigNumber(10).exponentiatedBy(assetDecimals))
                .plus(0.0001);
        } catch (error) {
            console.error("Error fetching fees:", red(extractError(error)));
            if ((asset as string) === "FIL") {
                suggestedAmount = 0.2;
            } else {
                suggestedAmount = 0.0015;
            }
        }

        const lockAndMint = await renJS.lockAndMint(params);

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

            lockAndMint.on("deposit", (deposit) => {
                const hash = deposit.txHash();

                const color = colors[i % colors.length];
                i += 1;

                deposit._state.logger = new SimpleLogger(
                    logLevel,
                    color(`[${hash.slice(0, 6)}]`),
                );

                deposit._state.logger.log(
                    `Received ${
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        new BigNumber((deposit.depositDetails as any).amount)
                            .div(
                                new BigNumber(10).exponentiatedBy(
                                    assetDecimals,
                                ),
                            )
                            .toFixed()
                    } ${asset}`,
                    deposit.depositDetails,
                );

                RenJS.defaultDepositHandler(deposit)
                    .then(resolve)
                    .catch((error) =>
                        deposit._state.logger.error(red("error:"), error),
                    );
            });

            sleep(30 * SECONDS)
                .then(() => {
                    // If there's been no deposits, send one.
                    if (i === 0) {
                        console.log(
                            `${blue("[faucet]")} Sending ${blue(
                                suggestedAmount.toFixed(),
                            )} ${blue(asset)} to ${blue(
                                typeof lockAndMint.gatewayAddress === "string"
                                    ? lockAndMint.gatewayAddress
                                    : JSON.stringify(
                                          lockAndMint.gatewayAddress,
                                      ),
                            )}`,
                        );

                        const options = { params: undefined };
                        let address = "";
                        if (typeof lockAndMint.gatewayAddress === "string") {
                            address = lockAndMint.gatewayAddress;
                        } else if ((asset as string) === "FIL") {
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            address = (lockAndMint.gatewayAddress as Chains.FilAddress)
                                .address;
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            options.params = (lockAndMint.gatewayAddress as Chains.FilAddress).params;
                        } else {
                            return;
                        }
                        account
                            .send(address, suggestedAmount, asset, options)
                            .catch(reject);
                    }
                })
                .catch(console.error);
        });
    });
});
