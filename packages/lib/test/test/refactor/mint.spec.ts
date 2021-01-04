/* eslint-disable no-console */

import * as Chains from "@renproject/chains";

import {
    LockAndMintParams,
    LogLevel,
    RenNetwork,
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
import { Terra } from "@renproject/chains-terra";
import { TerraAddress } from "@renproject/chains-terra/build/main/api/deposit";

chai.should();

loadDotEnv();

const colors = [green, magenta, yellow, cyan, blue, red];

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

const FAUCET_ASSETS = ["BTC", "ZEC", "BCH", "ETH", "FIL", "LUNA"];

describe("Refactor: mint", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    longIt("mint to contract", async function() {
        this.timeout(100000000000);

        const asset = "LUNA" as string;

        const account = new CryptoAccount(PRIVATE_KEY, {
            network: "testnet",
            apiAddress: "https://lotus-cors-proxy.herokuapp.com/",
            terra: {
                URL: "https://tequila-lcd.terra.dev",
            },
        });

        const logLevel: LogLevel = LogLevel.Log;
        const renJS = new RenJS(RenNetwork.TestnetVDot3, { logLevel });

        const infuraURL = `${Chains.renTestnetVDot3.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const params: LockAndMintParams = {
            asset,
            from: Terra(),
            to: Chains.Ethereum(provider, Chains.renTestnetVDot3).Account({
                address: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B",
            }),
        };

        const assetDecimals = await params.from.assetDecimals(asset);

        // Use 0.0001 more than fee.
        let suggestedAmount: BigNumber | number;
        try {
            const fees = await renJS.getFees(params);
            suggestedAmount = fees.lock
                .div(new BigNumber(10).exponentiatedBy(assetDecimals))
                .times(2.5);
        } catch (error) {
            console.error("Error fetching fees:", red(extractError(error)));
            if (asset === "FIL") {
                suggestedAmount = 0.2;
            } else {
                suggestedAmount = 0.0015;
            }
        }

        const lockAndMint = await renJS.lockAndMint(params);

        console.info("gateway address:", lockAndMint.gatewayAddress);

        const faucetSupported = FAUCET_ASSETS.indexOf(asset) >= 0;

        if (faucetSupported) {
            console.log(
                `${asset} balance: ${await account.balanceOf(
                    asset,
                )} ${asset} (${await account.address(asset)})`,
            );
        }

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
                    if (faucetSupported && i === 0) {
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

                        const options = { params: undefined, memo: undefined };
                        let address = "";
                        if (typeof lockAndMint.gatewayAddress === "string") {
                            address = lockAndMint.gatewayAddress;
                        } else if (asset === "FIL" || asset === "LUNA") {
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            address = (lockAndMint.gatewayAddress as Chains.FilAddress)
                                .address;
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            options.params = (lockAndMint.gatewayAddress as Chains.FilAddress).params;
                            options.memo = (lockAndMint.gatewayAddress as TerraAddress).memo;
                        } else {
                            console.error(`Unknown address format.`);
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
