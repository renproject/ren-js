/* eslint-disable no-console */

import {
    Bitcoin,
    renTestnet,
    renMainnet,
    renBscMainnet,
    renBscTestnet,
    Ethereum,
    BinanceSmartChain,
    Zcash,
    BitcoinCash,
} from "@renproject/chains";

import { blue } from "chalk";
import RenJS from "@renproject/ren";
import chai from "chai";
import HDWalletProvider from "@truffle/hdwallet-provider";
import { config as loadDotEnv } from "dotenv";
import { provider } from "web3-providers";

chai.should();

loadDotEnv();

// const infuraURL = renBscTestnet.infura;
// const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);

describe("Refactor: fees", () => {
    const longIt = process.env.ALL_TESTS ? it : it.skip;
    longIt("fees can be fetched", async function () {
        this.timeout(100000000000);

        const MNEMONIC = process.env.MNEMONIC;

        const testnetInfuraURL = `${renTestnet.infura}/v3/${process.env.INFURA_KEY}`;
        const testnetProvider: provider = new HDWalletProvider(
            MNEMONIC,
            testnetInfuraURL,
            0,
            10,
        ) as any;

        const mainnetInfuraURL = `${renMainnet.infura}/v3/${process.env.INFURA_KEY}`;
        const mainnetProvider: provider = new HDWalletProvider(
            MNEMONIC,
            mainnetInfuraURL,
            0,
            10,
        ) as any;

        const bscMainnetInfuraURL = `${renBscMainnet.infura}/v3/${process.env.INFURA_KEY}`;
        const bscMainnetProvider: provider = new HDWalletProvider(
            MNEMONIC,
            bscMainnetInfuraURL,
            0,
            10,
        ) as any;

        const bscTestnetInfuraURL = `${renBscTestnet.infura}/v3/${process.env.INFURA_KEY}`;
        const bscTestnetProvider: provider = new HDWalletProvider(
            MNEMONIC,
            bscTestnetInfuraURL,
            0,
            10,
        ) as any;

        const ethTestnetVDot2 = Ethereum(testnetProvider, "testnet");
        const ethTestnetVDot3 = Ethereum(testnetProvider, "testnet-v0.3");
        const ethMainnetVDot2 = Ethereum(mainnetProvider, "mainnet");
        const ethMainnetVDot3 = Ethereum(mainnetProvider, "mainnet-v0.3");

        const bscTestnet = BinanceSmartChain(bscTestnetProvider, "testnet");
        const bscMainnet = BinanceSmartChain(bscMainnetProvider, "mainnet");

        const lockChains = [Bitcoin(), Zcash(), BitcoinCash()];
        const mintChains = [
            ethTestnetVDot2,
            ethTestnetVDot3,
            ethMainnetVDot2,
            ethMainnetVDot3,
            bscTestnet,
            bscMainnet,
        ];

        for (const mintChain of mintChains) {
            for (const lockChain of lockChains) {
                const renJS = new RenJS(
                    mintChain.renNetworkDetails.isTestnet
                        ? "testnet"
                        : "mainnet",
                );

                // Skip Dogecoin and Zcash on new mainnet
                if (
                    (lockChain.name === "Dogecoin" ||
                        lockChain.name === "Zcash" ||
                        lockChain.name === "BitcoinCash") &&
                    (mintChain.renNetworkDetails.name === "Mainnet v0.3" ||
                        mintChain.renNetworkDetails.name === "BSC Mainnet")
                ) {
                    continue;
                }

                console.log(
                    lockChain.name,
                    "&",
                    mintChain.name,
                    "on",
                    blue(mintChain.renNetworkDetails.name),
                );
                if (await mintChain.assetIsSupported(lockChain.asset)) {
                    for (const pair of [
                        {
                            asset: lockChain.asset,
                            from: lockChain,
                            to: mintChain,
                        },
                        {
                            asset: lockChain.asset,
                            to: lockChain,
                            from: mintChain,
                        },
                    ]) {
                        const fees = await renJS.getFees(pair);
                        const selector = renJS.renVM.selector(pair);
                        console.log(selector, fees);
                    }
                }
            }
        }
    });
});
