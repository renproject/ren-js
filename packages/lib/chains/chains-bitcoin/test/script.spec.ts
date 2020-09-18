// tslint:disable: no-console

import { fromBase64, fromHex, hash160 } from "@renproject/utils";
import { describe, it } from "mocha";

import { Bitcoin, BitcoinCash, Dogecoin, Zcash } from "../src";

require("dotenv").config();

describe("Common", () => {
    for (const ChainClass of [Bitcoin, Zcash, BitcoinCash, Dogecoin]) {
        for (const isTestnet of [false, true]) {
            it(ChainClass.constructor.name, async () => {
                const chain = new ChainClass();
                const gHash = fromBase64(
                    "cQ+CJ8bOP4RMopOCNDvbQ020Eu8KRpYykurZyKNFM1I="
                );

                const publicKey = fromHex(
                    "030dd65f7db2920bb229912e3f4213dd150e5f972c9b73e9be714d844561ac355c"
                );

                const address = chain._createAddress(
                    isTestnet,
                    hash160(publicKey),
                    gHash,
                    chain._p2shPrefix[isTestnet ? "testnet" : "mainnet"]
                );
                const script = chain._calculatePubKeyScript(
                    isTestnet,
                    hash160(publicKey),
                    gHash
                );

                if (false as boolean) {
                    console.log(
                        `${chain.name} ${
                            isTestnet ? "testnet" : "mainnet"
                        }: ${address}, ${script.toString("hex")}`
                    );
                }
            });
        }
    }
});
