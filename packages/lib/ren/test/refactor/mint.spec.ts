// tslint:disable: no-console

import { Bitcoin, Ethereum } from "@renproject/chains";
import { LogLevel, SimpleLogger } from "@renproject/interfaces";
import { renTestnet } from "@renproject/networks";
import { Ox, SECONDS, sleep } from "@renproject/utils";
import chai from "chai";
import { blue, cyan, green, magenta, red, yellow } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";

import RenJS from "../../src/index";

chai.should();

require("dotenv").config();

const colors = [green, magenta, yellow, cyan, blue, red];

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

describe("Refactor", () => {
    it("mint to contract", async function () {
        this.timeout(100000000000);

        const asset = "BTC";

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });

        // const network = renNetworkToEthereumNetwork(NETWORK as RenNetwork);

        const infuraURL = `${renTestnet.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const logLevel: LogLevel = LogLevel.Log;

        // const renJS = new RenJS(renVMProvider, { logLevel });
        const renJS = new RenJS("testnet", { logLevel });

        // Use 0.0001 more than fee.
        let suggestedAmount;
        try {
            const fees = await renJS.getFees();
            suggestedAmount = Math.floor(
                fees[asset.toLowerCase()].lock + 0.0001 * 1e8
            );
        } catch (error) {
            console.error(error);
            suggestedAmount = 0.0008 * 1e8;
        }

        const lockAndMint = await renJS.lockAndMint({
            asset,
            from: Bitcoin(),
            to: Ethereum(provider).Account({
                address: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66",
            }),
            nonce:
                "0x27de009e7ed49dc8b1a7ac0a6fcbd6c173df72068674cbb8aa2679d3c9529c4d",
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
                asset
            )} ${asset} (${await account.address(asset)})`
        );

        // await lockAndMint.processDeposit({
        //     transaction: {
        //         txHash:
        //             "aab2bdb228c073408dbc86591b2fa4023ef86ad3b988523439a83621725c6eca",
        //         amount: 30000,
        //         vOut: 0,
        //         confirmations: 445,
        //     },
        //     amount: "30000",
        // });

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
                    if (i === 0) {
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
