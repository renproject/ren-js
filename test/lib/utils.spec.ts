import chai from "chai";

import { strip0x } from "../../src/blockchain/common";
import { BURN_TOPIC, generateAddress, generateGHash, generatePHash } from "../../src/lib/utils";
import { Tokens } from "../../src/types/assets";
import { NetworkDevnet, NetworkTestnet } from "../../src/types/networks";

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

    it("Burn Topic hash", () => {
        BURN_TOPIC
            .should.equal("0x2275318eaeb892d338c6737eebf5f31747c1eab22b63ccbc00cd93d4e785c116");
    });

    const testcases = [
        { name: "testnet", network: NetworkTestnet, expectedHash: "0x6ac8690a3340bc5de36b39ea0a1f42a472765fd7ebe19351911e18838303dd3e", expectedAddress: "2NFHUxhcDYTc1sA9mK8go6eG1Tkb7Bqu1it" },
        { name: "devnet", network: NetworkDevnet, expectedHash: "0x4665a9c6b5286b27da5c858e465c32a1833c375d0ea7e8e98916ad735201af61", expectedAddress: "2N8uAwCEh4fsNki1bMfyjVwS6769yf2Juoa" },
    ];

    for (const testcase of testcases) {
        it(`generateGHash for ${testcase.name}`, () => {
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

            generateGHash(payload, amount, strip0x(to), Tokens.BTC.Btc2Eth, nonce, testcase.network)
                .should.equal(testcase.expectedHash);
        });

        it(`generateAddress ${testcase.name}`, () => {
            generateAddress(Tokens.BTC.Btc2Eth, testcase.expectedHash, testcase.network)
                .should.equal(testcase.expectedAddress);
        });
    }
});
