import BigNumber from "bignumber.js";
import { expect } from "chai";

import { fromHex, Ox, toNBytes } from "../src/internal/common";
import {
    generateGHash,
    generateNHash,
    generatePHash,
    generateSHash,
    generateSighash,
} from "../src/renVMHashes";

describe("renVMHashes", () => {
    const payload: Uint8Array = toNBytes(1, 32);

    context("generateSHash", () => {
        it("hashes correctly", () => {
            expect(Ox(generateSHash("BTC/toEthereum"))).to.equal(
                "0x1fb79ec5bb04cf1aa8eb8fdeda8d3f986e5ebaba72d0e12048cec0a95188fe5e",
            );
            expect(Ox(generateSHash("ZEC/toFantom"))).to.equal(
                "0x2cb58c03e9b6bb1f395dd8a458fc8e76767253ae17b364c817871899e2cf48ad",
            );
        });

        it("removes from chain for host-to-host", () => {
            expect(Ox(generateSHash("BTC/fromFantomToEthereum"))).to.equal(
                Ox(generateSHash("BTC/toEthereum")),
            );
        });
    });

    it("generatePHash", () => {
        expect(Ox(generatePHash(payload))).to.equal(
            "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
        );
        expect(Ox(generatePHash(payload))).to.equal(
            "0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
        );
    });

    it("generateGHash", () => {
        const to = fromHex("00".repeat(20));
        const sHash = fromHex("00".repeat(20));
        const nonce = fromHex("00".repeat(32));

        expect(
            Ox(generateGHash(generatePHash(payload), to, sHash, nonce)),
        ).to.equal(
            "0x4b606c6a759e54ae3332637bd88050fff7be648b58d03f36491e277f94062ea9",
        );
    });

    it("generateNHash", () => {
        const nonce = fromHex("00".repeat(32));
        const txid = fromHex("00".repeat(32));
        const txindex = "1";
        expect(Ox(generateNHash(nonce, txid, txindex))).to.equal(
            "0xb92afca8929110484eee9b91373c9ed41205b90ce83867e5e9363041a70cfe3e",
        );
    });

    it("generateSighash", () => {
        const pHash = fromHex("12".repeat(32));
        const amount = new BigNumber(102);
        const to = fromHex("34".repeat(20));
        const selectorHash = fromHex("56".repeat(32));
        const nHash = fromHex("78".repeat(32));

        expect(
            Ox(generateSighash(pHash, amount, to, selectorHash, nHash)),
        ).to.equal(
            "0xcc6eacb85506fcb76a1951e79dfcc42a10751ff04bbfe5377fb06a1ecbe76e54",
        );
    });
});
