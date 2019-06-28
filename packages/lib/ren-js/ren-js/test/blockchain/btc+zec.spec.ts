import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";

import {
    createZECAddress, NetworkDevnet, NetworkMainnet, NetworkTestnet, zecAddressToHex,
} from "../../src";
import { btcAddressToHex, createBTCAddress } from "../../src/blockchain/btc";

require("dotenv").config();

chai.use((chaiBigNumber)(BigNumber));
chai.should();

describe("btc.ts", () => {
    describe("createBTCAddress", async () => {
        [
            { network: NetworkMainnet, expected: "3GhPbsey6igoAf99Akhjq97pKgQkDSv9fA", hex: "0x05a49bfb94554af98d1671e4325ed29a6ba531909689608b5d" },
            { network: NetworkTestnet, expected: "2NBcq1kFTCLceTAbZ7bP4FQy2PXQgp9jVV3", hex: "0xc4c9883ca4685d551f11e7587ca3f3b8806af3255a86cc94fa" },
            { network: NetworkDevnet, expected: "2MwYUXyeYRMPbs8HwVohfnC1KNafdbcjKuJ", hex: "0xc42f23b79d33674cb83031f662fcb7a429fbf5b16c4e5a1661" },
        ]
            .forEach(({ network, expected, hex }) => {
                it("mainnet", async () => {
                    const address = createBTCAddress(network, "0x1234");
                    address.should.equal(expected);
                    createBTCAddress(network, "1234")
                        .should.equal(address);
                    btcAddressToHex(address)
                        .should.equal(hex);
                });
            });
    });
});

describe("zec.ts", () => {
    describe("createBTCAddress", async () => {
        [
            { network: NetworkMainnet, expected: "t3ZZzcD5753UPmJC37BWrxxDjaLbq2Mqw6E", hex: "0x1cbda49bfb94554af98d1671e4325ed29a6ba5319096b4bf3f27" },
            { network: NetworkTestnet, expected: "t2QvR11qhRfWGPibeJdaMJuGKYKcmeTtFHd", hex: "0x1cbac9883ca4685d551f11e7587ca3f3b8806af3255a36521ff4" },
            { network: NetworkDevnet, expected: "t2Ar4XFEnegHDogJ2gqtxqgJcXNsiVBmJA3", hex: "0x1cba2f23b79d33674cb83031f662fcb7a429fbf5b16c7d4732b0" },
        ]
            .forEach(({ network, expected, hex }) => {
                it("mainnet", async () => {
                    const address = createZECAddress(network, "0x1234");
                    address.should.equal(expected);
                    createZECAddress(network, "1234")
                        .should.equal(address);
                    zecAddressToHex(address)
                        .should.equal(hex);
                });
            });
    });
});
