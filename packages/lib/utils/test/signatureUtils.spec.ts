import { Logger, SimpleLogger } from "@renproject/interfaces";
import { expect } from "earljs";

import { fromBigNumber, fromHex } from "../src/common";
import {
    fixSignature,
    fixSignatureSimple,
    secp256k1n,
    signatureToBuffer,
} from "../src/signatureUtils";

describe("signatureUtils", () => {
    context("signatureToBuffer", () => {
        it("should convert a signature to a buffer", () => {
            expect(
                signatureToBuffer({
                    r: Buffer.from("00".repeat(32), "hex"),
                    s: Buffer.from("00".repeat(32), "hex"),
                    v: 0,
                }),
            ).toEqual(Buffer.from("00".repeat(65), "hex"));
        });
    });

    context("fixSignature", () => {
        it("should return fixed signatures", () => {
            const correctSigHash = fromHex(
                "dfded4ed5ac76ba7379cfe7b3b0f53e768dca8d45a34854e649cfc3c18cbd9cd",
            );
            const wrongSigHash = Buffer.from("00".repeat(32), "hex");
            const pHash = Buffer.from("00".repeat(32), "hex");
            const amount = "0";
            const to = "0x" + "00".repeat(20);
            const tokenIdentifier = "0x" + "00".repeat(20);
            const nHash = Buffer.from("00".repeat(32), "hex");

            let warned = false;
            const logger: Logger = new SimpleLogger();
            logger.warn = () => {
                warned = true;
            };

            // No warning

            expect(
                fixSignature(
                    Buffer.from("00".repeat(32), "hex"),
                    Buffer.from("00".repeat(32), "hex"),
                    0,
                    wrongSigHash,
                    pHash,
                    amount,
                    to,
                    tokenIdentifier,
                    nHash,
                    false,
                ),
            ).toEqual({
                r: Buffer.from("00".repeat(32), "hex"),
                s: Buffer.from("00".repeat(32), "hex"),
                v: 27,
            });

            // Pass in correct sigHash:

            expect(
                fixSignature(
                    Buffer.from("00".repeat(32), "hex"),
                    Buffer.from("00".repeat(32), "hex"),
                    0,
                    correctSigHash,
                    pHash,
                    amount,
                    to,
                    tokenIdentifier,
                    nHash,
                    false,
                    logger,
                ),
            ).toEqual({
                r: Buffer.from("00".repeat(32), "hex"),
                s: Buffer.from("00".repeat(32), "hex"),
                v: 27,
            });
            expect(warned).toEqual(false);

            // Pass in wrong sigHash:

            expect(
                fixSignature(
                    Buffer.from("00".repeat(32), "hex"),
                    Buffer.from("00".repeat(32), "hex"),
                    0,
                    wrongSigHash,
                    pHash,
                    amount,
                    to,
                    tokenIdentifier,
                    nHash,
                    false,
                    logger,
                ),
            ).toEqual({
                r: Buffer.from("00".repeat(32), "hex"),
                s: Buffer.from("00".repeat(32), "hex"),
                v: 27,
            });
            expect(warned).toEqual(true);
        });
    });

    context("fixSignatureSimple", () => {
        it("should return fixed signatures", () => {
            expect(
                fixSignatureSimple(
                    Buffer.from("00".repeat(32), "hex"),
                    Buffer.from("00".repeat(32), "hex"),
                    0,
                ),
            ).toEqual({
                r: Buffer.from("00".repeat(32), "hex"),
                s: Buffer.from("00".repeat(32), "hex"),
                v: 27,
            });
            expect(
                fixSignatureSimple(
                    Buffer.from("00".repeat(32), "hex"),
                    fromBigNumber(secp256k1n),
                    0,
                ),
            ).toEqual({
                r: Buffer.from("00".repeat(32), "hex"),
                s: Buffer.from("00".repeat(32), "hex"),
                v: 28,
            });
            expect(
                fixSignatureSimple(
                    Buffer.from("00".repeat(32), "hex"),
                    fromBigNumber(secp256k1n),
                    1,
                ),
            ).toEqual({
                r: Buffer.from("00".repeat(32), "hex"),
                s: Buffer.from("00".repeat(32), "hex"),
                v: 27,
            });
        });
    });
});
