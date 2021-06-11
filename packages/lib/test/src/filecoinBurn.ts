/* eslint-disable no-console */
import { Filecoin } from "@renproject/chains-filecoin";
import { Ethereum, renTestnetVDot3 } from "@renproject/chains-ethereum";
import RenJS from "@renproject/ren";
import { blue } from "chalk";
import HDWalletProvider from "@truffle/hdwallet-provider";
import { config as loadDotEnv } from "dotenv";
import { LogLevel, RenNetwork, SimpleLogger } from "@renproject/interfaces";
import { provider } from "web3-core";

// Load environment variables.
loadDotEnv();
const MNEMONIC = process.env.MNEMONIC;

const logLevel = LogLevel.Log;

const main = async () => {
    const renJS = new RenJS(RenNetwork.TestnetVDot3, { logLevel });

    // Initialize Ethereum provider.
    const infuraURL = `${renTestnetVDot3.infura}/v3/${
        process.env.INFURA_KEY || ""
    }`; // renBscTestnet.infura
    const provider: provider = new HDWalletProvider({
        mnemonic: MNEMONIC || "",
        providerOrUrl: infuraURL,
        addressIndex: 0,
        numberOfAddresses: 10,
    }) as any;

    const burnAndRelease = await renJS.burnAndRelease({
        asset: "FIL",
        to: Filecoin().Address("t14wczuvodunv3xzexobzywpbj6qpr6jwdrbkrmbq"),
        from: Ethereum(provider).BurnNonce(0x16a),
    });

    // Store number of Ethereum transactions.
    let confirmations = 0;

    // `.burn` returns a Web3 PromiEvent.
    await burnAndRelease
        .burn()
        .on("confirmation", (confs) => {
            confirmations = confs;
        })
        .on("transactionHash", (txHash) =>
            burnAndRelease._state.logger.log(
                `${burnAndRelease.params.from?.name} transactionHash: ${String(
                    txHash,
                )}`,
            ),
        );

    // Note - the RenVM txHash is only available after calling `.burn`.
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

    // Note - the typings for `out` are currently outdated - this will be fixed
    // in the next release. Use `result.out.amount` and `result.out.txid`.
    burnAndRelease._state.logger.log(result.out);
};

main().catch(console.error);
