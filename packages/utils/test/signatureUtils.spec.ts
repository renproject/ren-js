import { expect } from "chai";
import { concat } from "ethers/lib/utils";

import { utils } from "../src";
import { normalizeSignature } from "../src/common";
import { fromHex } from "../src/internal/common";

const secp256k1nBuffer = fromHex(
    "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);

describe("signatureUtils", () => {
    context("normalizeSignature", () => {
        it("should return fixed signatures", () => {
            expect(
                utils.toHex(
                    normalizeSignature(
                        concat([
                            fromHex("11".repeat(32)),
                            fromHex("00".repeat(32)),
                            new Uint8Array([0]),
                        ]),
                    ),
                ),
            ).to.deep.equal(
                utils.toHex(
                    concat([
                        fromHex("11".repeat(32)),
                        fromHex("00".repeat(32)),
                        new Uint8Array([27]),
                    ]),
                ),
            );
            expect(
                utils.toHex(
                    normalizeSignature(
                        concat([
                            fromHex("00".repeat(32)),
                            fromHex("00".repeat(32)),
                            new Uint8Array([0]),
                        ]),
                    ),
                ),
            ).to.deep.equal(
                utils.toHex(
                    concat([
                        fromHex("00".repeat(32)),
                        fromHex("00".repeat(32)),
                        new Uint8Array([0]),
                    ]),
                ),
            );
            expect(
                utils.toHex(
                    normalizeSignature(
                        concat([
                            fromHex("00".repeat(32)),
                            secp256k1nBuffer,
                            new Uint8Array([0]),
                        ]),
                    ),
                ),
            ).to.deep.equal(
                utils.toHex(
                    concat([
                        fromHex("00".repeat(32)),
                        fromHex("00".repeat(32)),
                        new Uint8Array([28]),
                    ]),
                ),
            );
            expect(
                utils.toHex(
                    normalizeSignature(
                        concat([
                            fromHex("00".repeat(32)),
                            secp256k1nBuffer,
                            new Uint8Array([1]),
                        ]),
                    ),
                ),
            ).to.deep.equal(
                utils.toHex(
                    concat([
                        fromHex("00".repeat(32)),
                        fromHex("00".repeat(32)),
                        new Uint8Array([27]),
                    ]),
                ),
            );
        });
    });
});
