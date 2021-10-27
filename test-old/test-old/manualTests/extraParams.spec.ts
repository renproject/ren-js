/* eslint-disable no-console */

import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import { config as loadDotEnv } from "dotenv";
import CryptoAccount from "send-crypto";

import * as Chains from "@renproject/chains";
import RenJS from "@renproject/ren";
import {
    extractError,
    LogLevel,
    Ox,
    SECONDS,
    SimpleLogger,
    sleep,
} from "@renproject/utils";
import HDWalletProvider from "@truffle/hdwallet-provider";

chai.should();

loadDotEnv();

const colors = [green, magenta, yellow, cyan, blue, red];

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

describe("Extra params", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    longIt("mint", async function () {
        this.timeout(100000000000);

        const from = Chains.Bitcoin();
        const asset = "BTC";
        const faucetSupported =
            ["BTC", "ZEC", "BCH", "ETH"].indexOf(asset) >= 0;

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });

        const logLevel = LogLevel.Log;

        const network = Chains.renTestnet;
        const renJS = new RenJS("testnet", { logLevel });

        const infuraURL = network.rpcUrl({
            infura: process.env.INFURA_KEY,
        });
        const provider = new HDWalletProvider({
            mnemonic: MNEMONIC || "",
            providerOrUrl: infuraURL,
            addressIndex: 0,
            numberOfAddresses: 10,
        });

        let contractAddress: string;
        switch (network.networkID) {
            case 4:
                contractAddress = "0x0141966753f8C7D7e6Dc01Fc324200a65Cf49525";
                break;
            case 42:
                contractAddress = "0x56ECbD7e6953FE814B619f6757882d517701FB79";
                break;
            default:
                throw new Error(`Network not supported: ${network.name}`);
        }

        const to = Chains.Ethereum(provider, network).Contract({
            sendTo: contractAddress,
            contractFn: "mintExtra",
            contractParams: [
                {
                    type: "string",
                    name: "_symbol",
                    value: asset,
                },
                {
                    type: "address",
                    name: "_recipient",
                    value: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B",
                },
                {
                    type: "string",
                    name: "_extraMsg",
                    value: "", // Default value
                    notInPayload: true,
                },
            ],
        });

        // Use 0.0001 more than fee.
        let suggestedAmount: number;
        try {
            const fees = await renJS.getFees({
                asset,
                from,
                to,
            });
            const fee: number = fees[asset.toLowerCase()].lock;
            suggestedAmount = Math.floor(fee + 0.0001 * 1e8);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Error fetching fees:", red(extractError(error)));
            suggestedAmount = 0.0015 * 1e8;
        }

        const lockAndMint = await renJS.lockAndMint({
            asset,
            from,
            to,

            nonce: Ox("00".repeat(32)),
        });

        console.info(
            `Deposit ${blue(asset)} to ${blue(
                JSON.stringify(lockAndMint.gatewayAddress, null, "    "),
            )}`,
        );

        if (faucetSupported) {
            console.log(
                `${blue("[faucet]")} ${blue(asset)} balance is ${blue(
                    await account.balanceOf(asset),
                )} ${blue(asset)} (${blue(await account.address(asset))})`,
            );
        }

        await new Promise((resolve, reject) => {
            const counter = { i: 0 };
            lockAndMint.on("deposit", (deposit) => {
                const hash = deposit.txHash();

                // if (deposit.depositDetails.amount === "80000") {
                //     return;
                // }

                const color = colors[counter.i];
                counter.i += 1;

                deposit._state.logger = new SimpleLogger(
                    logLevel,
                    color(`[${hash.slice(0, 6)}]`),
                );

                deposit._state.logger.debug(
                    `Received ${
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (deposit.depositDetails as any).amount / 1e8
                    } ${deposit.params.asset}`,
                    deposit.depositDetails,
                );

                RenJS.defaultDepositHandler(deposit)
                    .then(resolve)
                    .catch(deposit._state.logger.error);
            });

            sleep(10 * SECONDS)
                .then(() => {
                    // If there's been no deposits, send one.
                    if (
                        faucetSupported &&
                        typeof lockAndMint.gatewayAddress === "string" &&
                        counter.i === 0
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
