import BigNumber from "bignumber.js";
import chai from "chai";
import { blue, red } from "chalk";
import { config as loadDotEnv } from "dotenv";
import CryptoAccount from "send-crypto";

/* eslint-disable no-console */
import * as Chains from "@renproject/chains";
import { LogLevel, RenNetwork, SimpleLogger } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { BurnAndReleaseStatus } from "@renproject/ren/build/main/burnAndRelease";
import { extractError } from "@renproject/utils";
import HDWalletProvider from "@truffle/hdwallet-provider";

chai.should();

loadDotEnv();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;

const testPK = Buffer.from(
    "a84252a5fcbb2bfb85a422a4833a79c23ec7906826a0298dd2a0744a4c984631d2e4cf6c0c5f3403c12e952901ab88e33fc98b07500a94136e6635a089e23f94",
    "hex",
);

describe("Refactor - Burning", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    longIt("burning from contract", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Testnet;
        const FromClass = Chains.Goerli;
        const ToClass = Chains.Terra;
        const asset = "LUNA";

        const ethNetwork = FromClass.configMap[network];

        const infuraURL = ethNetwork.rpcUrl({
            infura: process.env.INFURA_KEY,
        });
        // const infuraURL = ethNetwork.infura; // renBscTestnet.infura
        const provider = new HDWalletProvider({
            mnemonic: MNEMONIC || "",
            providerOrUrl: infuraURL,
            addressIndex: 0,
            numberOfAddresses: 10,
        });

        // const provider = makeTestProvider(renMainnet, testPK);
        // const fromAddress = provider.wallet.publicKey.toString();
        const from = new FromClass(provider, ethNetwork);

        // Recipient.
        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        const recipient = await account.address(asset);

        const to = ToClass().Address(recipient);
        // const from = FromClass(provider, network);
        // const fromAddress = (await from.web3.eth.getAccounts())[0];

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Error fetching fees:", red(extractError(error)));
            suggestedAmount = new BigNumber(0.0002).times(
                new BigNumber(10).exponentiatedBy(decimals),
            );
        }

        // console.log(
        //     `Burning ${toReadable(
        //         suggestedAmount,
        //         decimals,
        //     ).toFixed()} ${asset} of ${toReadable(
        //         await from.getBalance(asset, fromAddress),
        //         decimals,
        //     ).toFixed()} ${asset} to ${recipient}`,
        // );

        const burnAndRelease = await renJS.burnAndRelease({
            asset,
            to,
            from: from.Account({ value: suggestedAmount }),
            // transaction:
            // "4AhRGqgBnZwXv66MPh9XoDMzHgNAy7o6AKyVJSNWUe5RFo2fEyPiEm9XuMJw19rgG4BWpkxSWNrqoPn6jYJ9yV35",
            // burnNonce: 2,
        });

        let confirmations = 0;

        console.log(`step 1`);
        await burnAndRelease
            .burn()
            .on("confirmation", (conf, target) => {
                burnAndRelease._state.logger.log(
                    `confirming (${conf}/${target})`,
                );
                confirmations = conf;
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

        await burnAndRelease
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

        const ethNetwork = Chains.renTestnet;
        const infuraURL = ethNetwork.rpcUrl({
            infura: process.env.INFURA_KEY,
        });
        const provider = new HDWalletProvider({
            mnemonic: MNEMONIC || "",
            providerOrUrl: infuraURL,
            addressIndex: 0,
            numberOfAddresses: 10,
        });

        const asset = "BTC";

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });
        const recipient = await account.address(asset);

        const from = Chains.Ethereum(provider, Chains.renTestnet);
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
