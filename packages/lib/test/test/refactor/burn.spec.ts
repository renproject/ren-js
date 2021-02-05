/* eslint-disable no-console */
import * as Chains from "@renproject/chains";
import { Terra } from "@renproject/chains-terra";

import RenJS from "@renproject/ren";
import { extractError, toReadable, fromReadable } from "@renproject/utils";
import BigNumber from "bignumber.js";
import chai from "chai";
import { blue, red } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";
import { config as loadDotEnv } from "dotenv";
import { LogLevel, RenNetwork, SimpleLogger } from "@renproject/interfaces";
import { BscConfigMap, EthereumConfigMap } from "@renproject/chains";
import { BurnAndReleaseStatus } from "@renproject/ren/build/main/burnAndRelease";

chai.should();

loadDotEnv();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

describe("Refactor - Burning", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    it.skip("burning from contract", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.TestnetVDot3;
        // const ethNetwork = EthereumConfigMap[network];
        const ethNetwork = BscConfigMap[network];

        // const infuraURL = `${ethNetwork.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const infuraURL = ethNetwork.infura; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        // Recipient.
        const asset = "BTC";
        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        const recipient = await account.address(asset);

        const to = Chains.Bitcoin().Address(recipient);
        const from = Chains.BinanceSmartChain(provider, network);
        const fromAddress = (await from.web3.eth.getAccounts())[0];

        const logLevel = LogLevel.Log;
        const renJS = new RenJS(network, { logLevel });

        const decimals = to.assetDecimals(asset);

        // Use 0.0001 more than fee.
        let suggestedAmount: BigNumber;
        try {
            const fees = await renJS.getFees({
                asset,
                from,
                to,
            });
            const fee = fees.release;
            suggestedAmount = fee.times(1.01);
        } catch (error) {
            console.error("Error fetching fees:", red(extractError(error)));
            suggestedAmount = new BigNumber(0.0002).times(
                new BigNumber(10).exponentiatedBy(decimals),
            );
        }

        console.log(
            `Burning ${toReadable(
                suggestedAmount,
                decimals,
            ).toFixed()} ${asset} of ${toReadable(
                await from.getBalance(asset, fromAddress),
                decimals,
            ).toFixed()} ${asset} to ${recipient}`,
        );

        const burnAndRelease = await renJS.burnAndRelease({
            asset,
            to,
            from: from.Account({ value: suggestedAmount }),
        });

        let confirmations = 0;

        console.log(`step 1`);
        await burnAndRelease
            .burn()
            .on("confirmation", (confs) => {
                confirmations = confs;
            })
            .on("transactionHash", (txHash) =>
                burnAndRelease._state.logger.log(
                    `${
                        burnAndRelease.params.from.name
                    } transactionHash: ${String(txHash)}`,
                ),
            );

        console.log(`step 2`);
        burnAndRelease._state.logger = new SimpleLogger(
            logLevel,
            blue(`[${burnAndRelease.txHash().slice(0, 6)}]`),
        );

        const targetConfirmations = await burnAndRelease.confirmationTarget();

        const result = await burnAndRelease
            .release()
            .on("status", (status) =>
                status === "confirming"
                    ? burnAndRelease._state.logger.log(
                          `confirming (${confirmations}/${targetConfirmations})`,
                      )
                    : burnAndRelease._state.logger.log(status),
            )
            .on("txHash", (txHash) =>
                burnAndRelease._state.logger.log(`Ren txHash: ${txHash}`),
            )
            .on("transaction", (transaction) => {
                burnAndRelease._state.logger.log(
                    `Release: ${burnAndRelease.params.to.utils.transactionExplorerLink(
                        transaction,
                    )}`,
                );
            });

        if (burnAndRelease.status === BurnAndReleaseStatus.Reverted) {
            console.error(
                `RenVM transaction reverted${
                    burnAndRelease.revertReason
                        ? ": " + burnAndRelease.revertReason
                        : ""
                }`,
            );
        }

        console.log(burnAndRelease.releaseTransaction);
    });

    longIt("burning from address", async function () {
        this.timeout(100000000000);

        const infuraURL = `${Chains.renTestnetVDot3.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const asset = "BTC";

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        const recipient = await account.address(asset);

        const from = Chains.Ethereum(provider, Chains.renTestnetVDot3);
        const to = Chains.Bitcoin().Address(recipient);

        const renJS = new RenJS("testnet");

        // Use 0.0001 more than fee.
        const fees = await renJS.getFees({
            asset,
            to,
            from,
        });
        const fee: number = fees[asset.toLowerCase()].release;
        const suggestedAmount = new BigNumber(Math.floor(fee + 0.0001 * 1e8))
            .decimalPlaces(0)
            .toFixed();

        const burnAndRelease = await renJS.burnAndRelease({
            asset,
            to,
            from: from.Account({ value: suggestedAmount }),
        });

        let confirmations = 0;

        await burnAndRelease
            .burn()
            .on("confirmation", (confs) => {
                confirmations = confs;
            })
            .on("transactionHash", console.log);

        await burnAndRelease
            .release()
            .on("status", (status) =>
                status === "confirming"
                    ? console.log(`confirming (${confirmations}/15)`)
                    : console.log(status),
            )
            .on("txHash", console.log);
    });
});
