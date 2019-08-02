import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";

import {
    createZECAddress, NetworkDevnet, NetworkLocalnet, NetworkMainnet, NetworkTestnet,
    zecAddressToHex,
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
            { network: NetworkDevnet, expected: "2MtwAyKZbBQZPsGxP1YJpkcYzp7LbkvUNqU", hex: "0xc412863f01ba5f995ac61bbc19408505f74d3725810054eb57" },
            { network: NetworkLocalnet, expected: "2NDzLJ2KMJYmFKw1HLs4v9Q98CpFCFieYaF", hex: "0xc4e389aa7813cdb55b76f166f125d8ea5b86234dec11371dbc" },
        ]
            .forEach(({ network, expected, hex }) => {
                it(network.name, async () => {
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
            { network: NetworkDevnet, expected: "t28Ekxb9qQjT1opxUCaW7p6rHxuYgi519yv", hex: "0x1cba12863f01ba5f995ac61bbc19408505f74d372581bb37bc25" },
            { network: NetworkLocalnet, expected: "t2THvHHubXsesGV1NXuGDCtSRMcTHD8cch6", hex: "0x1cbae389aa7813cdb55b76f166f125d8ea5b86234decd6835f69" },
        ]
            .forEach(({ network, expected, hex }) => {
                it(network.name, async () => {
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
