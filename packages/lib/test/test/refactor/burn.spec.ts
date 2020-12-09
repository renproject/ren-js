/* eslint-disable no-console */
import * as Chains from "@renproject/chains";

import RenJS from "@renproject/ren";
import { extractError } from "@renproject/utils";
import BigNumber from "bignumber.js";
import chai from "chai";
import { blue, red } from "chalk";
import CryptoAccount from "send-crypto";
import HDWalletProvider from "truffle-hdwallet-provider";
import { config as loadDotEnv } from "dotenv";
import { LogLevel, RenNetwork, SimpleLogger } from "@renproject/interfaces";

chai.should();

loadDotEnv();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

describe("Refactor - Burning", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    it("burning from contract", async function() {
        this.timeout(100000000000);

        const network = RenNetwork.TestnetVDot3;

        const infuraURL = `${Chains.renTestnetVDot3.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        // Bitcoin recipient.
        const asset = "FIL";
        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        const recipient = await account.address(asset);
        const to = Chains.Filecoin().Address(recipient);

        const from = Chains.Ethereum(provider, Chains.renTestnetVDot3);

        const logLevel = LogLevel.Log;
        const renJS = new RenJS(network, { logLevel });

        // Use 0.0001 more than fee.
        let suggestedAmount: number | string;
        try {
            const fees = await renJS.getFees();
            const fee: number = fees[asset.toLowerCase()].release;
            suggestedAmount = Math.floor(fee + 0.0001 * 1e8);
        } catch (error) {
            console.error("Error fetching fees:", red(extractError(error)));
            suggestedAmount = new BigNumber(0.0002)
                .times(new BigNumber(10).exponentiatedBy(18))
                .toFixed();
        }

        const burnAndRelease = await renJS.burnAndRelease({
            asset,
            to,
            from: from.Account({
                value: suggestedAmount,
            }),
        });

        let confirmations = 0;

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

        burnAndRelease._state.logger = new SimpleLogger(
            logLevel,
            blue(`[${burnAndRelease.txHash().slice(0, 6)}]`),
        );

        const result = await burnAndRelease
            .release()
            .on("status", (status) =>
                status === "confirming"
                    ? burnAndRelease._state.logger.log(
                          `confirming (${confirmations}/15)`,
                      )
                    : burnAndRelease._state.logger.log(status),
            )
            .on("txHash", (txHash) =>
                burnAndRelease._state.logger.log(`Ren txHash: ${txHash}`),
            );

        console.log(result.out);
    });

    longIt("burning from address", async function() {
        this.timeout(100000000000);

        const infuraURL = `${Chains.renTestnetVDot3.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

        const asset = "BTC";
        const from = Chains.Ethereum(provider, Chains.renTestnetVDot3);

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        const recipient = await account.address(asset);

        const renJS = new RenJS("testnet");

        // Use 0.0001 more than fee.
        const fees = await renJS.getFees();
        const fee: number = fees[asset.toLowerCase()].release;
        const suggestedAmount = new BigNumber(Math.floor(fee + 0.0001 * 1e8))
            .decimalPlaces(0)
            .toFixed();

        const burnAndRelease = await renJS.burnAndRelease({
            asset,
            to: Chains.Bitcoin().Address(recipient),
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
