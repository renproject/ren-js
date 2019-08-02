import chai from "chai";

import { strip0x } from "../../src/blockchain/common";
import { BURN_TOPIC, generateAddress, generateGHash, generatePHash } from "../../src/lib/utils";
import { Tokens } from "../../src/types/assets";
import { NetworkTestnet } from "../../src/types/networks";

require("dotenv").config();

chai.should();

describe("Utils", function () {
    // Disable test timeout.
    this.timeout(0);

    it("generatePHash", () => {
        const expectedPHash = "0x65749241113ce04d4242ca414a5ba67c27eea1e74a5540367a1726770700bae2";
        const payload = [{
            name: "_shifter",
            type: "address",
            value: "0x8a0E8dfC2389726DF1c0bAB874dd2C9A6031b28f"
        },
        {
            name: "_address",
            type: "address",
            value: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B"
        }];

        generatePHash(payload).should.equal(expectedPHash);
    });

    it("generateGHash", () => {
        const expectedHash = "0xdf7490bdf74b57ae18aebe3d8beb8ea3e11604f2bae4e2487adfd6b13dbd39c9";
        const payload = [{
            name: "_shifter",
            type: "address",
            value: "0x8a0E8dfC2389726DF1c0bAB874dd2C9A6031b28f"
        },
        {
            name: "_address",
            type: "address",
            value: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B"
        }];

        const amount = 22500;
        const to = "0xC99Ab5d1d0fbf99912dbf0DA1ADC69d4a3a1e9Eb";
        const nonce = "0x3205f743e45858d2a797a88d867264ab9d3b310fc0853056cdd92d9b1b4bd1d5";

        generateGHash(payload, amount, strip0x(to), Tokens.BTC.Btc2Eth, nonce, NetworkTestnet)
            .should.equal(expectedHash);
    });

    it("generateAddress", () => {
        const hash = "0xdf7490bdf74b57ae18aebe3d8beb8ea3e11604f2bae4e2487adfd6b13dbd39c9";
        const expectedAddress = "2MvPVJVxeEiEG7kH2Y67xmV58gXQKQKjZAn";
        generateAddress(Tokens.BTC.Btc2Eth, hash, NetworkTestnet)
            .should.equal(expectedAddress);
    });

    it("Burn Topic hash", () => {
        BURN_TOPIC
            .should.equal("0x2275318eaeb892d338c6737eebf5f31747c1eab22b63ccbc00cd93d4e785c116");
    });
});
