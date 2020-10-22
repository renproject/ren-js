import { EthArgs, LogLevel, SimpleLogger } from "@renproject/interfaces";
import { expect } from "earljs";

import { fromHex, Ox } from "../src/common";
import {
    generateBurnTxHash,
    generateGHash,
    generatePHash,
    generateSighash,
    renVMHashToBase64,
} from "../src/renVMHashes";

describe("renVMHashes", () => {
    const payload: EthArgs = [{ name: "payload", type: "uint256", value: 1 }];

    context("generatePHash", () => {
        it("...", () => {
            expect(Ox(generatePHash(payload))).toEqual(
                "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
            );
            const logger = new SimpleLogger(LogLevel.Error);
            expect(
                Ox(generatePHash(([payload] as unknown) as EthArgs, logger)),
            ).toEqual(
                "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
            );
        });
    });
    context("generateGHash", () => {
        it("...", () => {
            const to = "0x" + "00".repeat(20);
            const tokenIdentifier = "0x" + "00".repeat(20);
            const nonce = Buffer.from("00".repeat(32), "hex");
            const logger = new SimpleLogger(LogLevel.Error);

            expect(
                Ox(generateGHash(payload, to, tokenIdentifier, nonce, false)),
            ).toEqual(
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
            ).toEqual(
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
            ).toEqual(
                "0x24bac9fd9de6373553c96708216414e9e996cef63ba7f63dcf25af9bf7f3aa99",
            );
        });
    });
    context("generateSighash", () => {
        it("...", () => {
            const pHash = Buffer.from("00".repeat(32), "hex");
            const amount = "0";
            const to = "0x" + "00".repeat(20);
            const tokenIdentifier = "0x" + "00".repeat(20);
            const nHash = Buffer.from("00".repeat(32), "hex");

            expect(
                Ox(generateSighash(pHash, amount, to, tokenIdentifier, nHash)),
            ).toEqual(
                "0xdfded4ed5ac76ba7379cfe7b3b0f53e768dca8d45a34854e649cfc3c18cbd9cd",
            );

            expect(
                Ox(
                    generateSighash(
                        pHash,
                        amount,
                        to,
                        tokenIdentifier,
                        nHash,
                        true,
                    ),
                ),
            ).toEqual(
                "0x8ad242e63f483e9d211e41157b7e4e955662d9a8bb634249b1ddee83d2f364cf",
            );
        });
    });
    context("renVMHashToBase64", () => {
        it("...", () => {
            expect(renVMHashToBase64("00".repeat(32))).toEqual(
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            );
            expect(renVMHashToBase64(Ox("00".repeat(32)))).toEqual(
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            );
            expect(
                renVMHashToBase64(
                    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                ),
            ).toEqual("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
        });
    });
    context("generateBurnTxHash", () => {
        it("...", () => {
            generateBurnTxHash("BTC0Btc2Eth", "id");
            const logger = new SimpleLogger(LogLevel.Error);
            generateBurnTxHash("BTC0Btc2Eth", "id", logger);
        });
    });
});
