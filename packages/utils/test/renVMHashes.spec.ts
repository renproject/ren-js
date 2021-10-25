import { expect } from "chai";

import { EthArgs, LogLevel, SimpleLogger } from "@renproject/utils";

import { Ox } from "../src/common";
import {
    generateBurnTxHash,
    generateGHash,
    generateNHash,
    generatePHash,
    generateSHash,
    generateSighash,
    renVMHashToBase64,
} from "../src/renVMHashes";

describe("renVMHashes", () => {
    const payload: EthArgs = [{ name: "payload", type: "uint256", value: 1 }];

    context("generateSHash", () => {
        it("hashes correctly", () => {
            expect(Ox(generateSHash("BTC/toEthereum"))).to.equal(
                "0x1fb79ec5bb04cf1aa8eb8fdeda8d3f986e5ebaba72d0e12048cec0a95188fe5e",
            );
            expect(Ox(generateSHash("ZEC/toBSC"))).to.equal(
                "0x3a3ff3e90668ea5ba2cd0bccf89f5002c959f7555337c7258c0d09204ef45bdf",
            );
        });

        it("removes from chain for host-to-host", () => {
            expect(Ox(generateSHash("BTC/fromBSCToEthereum"))).to.equal(
                Ox(generateSHash("BTC/toEthereum")),
            );
        });
    });

    context("generatePHash", () => {
        it("hashes correctly", () => {
            expect(Ox(generatePHash(payload))).to.equal(
                "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
            );
            const logger = new SimpleLogger(LogLevel.Error);
            expect(
                Ox(generatePHash([payload] as unknown as EthArgs, logger)),
            ).to.equal(
                "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
            );
        });
    });

    context("generateGHash", () => {
        it("hashes correctly", () => {
            const to = "0x" + "00".repeat(20);
            const tokenIdentifier = "0x" + "00".repeat(20);
            const nonce = Buffer.from("00".repeat(32), "hex");
            const logger = new SimpleLogger(LogLevel.Error);

            expect(
                Ox(generateGHash(payload, to, tokenIdentifier, nonce, false)),
            ).to.equal(
                "0x6f100e032e0bebde989e4f337dd6d5776f3aca19a95fe0b228a14eeb9902e29a",
            );

            expect(
                Ox(
                    generateGHash(
                        payload,
                        to,
                        tokenIdentifier,
                        nonce,
                        false,
                        logger,
                    ),
                ),
            ).to.equal(
                "0x6f100e032e0bebde989e4f337dd6d5776f3aca19a95fe0b228a14eeb9902e29a",
            );

            expect(
                Ox(
                    generateGHash(
                        payload,
                        to,
                        "0x" + "00".repeat(32),
                        nonce,
                        true,
                        logger,
                    ),
                ),
            ).to.equal(
                "0xdf44e2dd785442663437c288ebc86fc3a45d61bacac7351fd273cb5fe1af675e",
            );
        });
    });

    context("generateNHash", () => {
        const nonce = Buffer.from("00".repeat(32), "hex");
        const txid = Buffer.from("00".repeat(32), "hex");
        const txindex = "1";
        it("v1", () => {
            expect(Ox(generateNHash(nonce, txid, txindex, false))).to.equal(
                "0xcbfe4baa920060fc34aa65135b74b83fa81df36f6e21d90c8301c8810d2c89d9",
            );
        });
        it("v2", () => {
            expect(Ox(generateNHash(nonce, txid, txindex, true))).to.equal(
                "0xb92afca8929110484eee9b91373c9ed41205b90ce83867e5e9363041a70cfe3e",
            );
        });
    });

    context("generateSighash", () => {
        it("hashes correctly", () => {
            const pHash = Buffer.from("00".repeat(32), "hex");
            const amount = "0";
            const to = "0x" + "00".repeat(20);
            const tokenIdentifier = "0x" + "00".repeat(20);
            const selectorHash = "0x" + "00".repeat(32);
            const nHash = Buffer.from("00".repeat(32), "hex");

            expect(
                Ox(generateSighash(pHash, amount, to, tokenIdentifier, nHash)),
            ).to.equal(
                "0xdfded4ed5ac76ba7379cfe7b3b0f53e768dca8d45a34854e649cfc3c18cbd9cd",
            );

            expect(
                Ox(
                    generateSighash(
                        pHash,
                        amount,
                        to,
                        selectorHash,
                        nHash,
                        true,
                    ),
                ),
            ).to.equal(
                "0xdfded4ed5ac76ba7379cfe7b3b0f53e768dca8d45a34854e649cfc3c18cbd9cd",
            );
        });
    });

    context("renVMHashToBase64", () => {
        it("v1", () => {
            expect(renVMHashToBase64("00".repeat(32), false)).to.equal(
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            );
            expect(renVMHashToBase64(Ox("00".repeat(32)), false)).to.equal(
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            );
            expect(
                renVMHashToBase64(
                    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                    false,
                ),
            ).to.equal("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
        });

        it("v2", () => {
            expect(renVMHashToBase64("00".repeat(32), true)).to.equal(
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            );
            expect(renVMHashToBase64(Ox("00".repeat(32)), true)).to.equal(
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            );
            expect(
                renVMHashToBase64(
                    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                    true,
                ),
            ).to.equal("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        });
    });

    context("generateBurnTxHash", () => {
        it("hashes correctly", () => {
            generateBurnTxHash("BTC0Btc2Eth", "id");
            const logger = new SimpleLogger(LogLevel.Error);
            generateBurnTxHash("BTC0Btc2Eth", "id", logger);
        });
    });
});
