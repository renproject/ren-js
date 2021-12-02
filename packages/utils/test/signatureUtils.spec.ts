import { expect } from "chai";

import { fixSignature } from "../src/fixSignature";

const secp256k1nBuffer = Buffer.from(
    "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
    "hex",
);

describe("signatureUtils", () => {
    context("fixSignature", () => {
        it("should return fixed signatures", () => {
            expect(
                fixSignature(
                    Buffer.from("00".repeat(32), "hex"),
                    Buffer.from("00".repeat(32), "hex"),
                    0,
                ),
            ).to.deep.equal({
                r: Buffer.from("00".repeat(32), "hex"),
                s: Buffer.from("00".repeat(32), "hex"),
                v: 27,
            });
            expect(
                fixSignature(
                    Buffer.from("00".repeat(32), "hex"),
                    secp256k1nBuffer,
                    0,
                ),
            ).to.deep.equal({
                r: Buffer.from("00".repeat(32), "hex"),
                s: Buffer.from("00".repeat(32), "hex"),
                v: 28,
            });
            expect(
                fixSignature(
                    Buffer.from("00".repeat(32), "hex"),
                    secp256k1nBuffer,
                    1,
                ),
            ).to.deep.equal({
                r: Buffer.from("00".repeat(32), "hex"),
                s: Buffer.from("00".repeat(32), "hex"),
                v: 27,
            });
        });
    });
});
