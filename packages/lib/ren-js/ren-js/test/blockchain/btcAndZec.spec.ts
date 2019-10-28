import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import { decode } from "bs58";

import {
    createZECAddress, NetworkDevnet, NetworkLocalnet, NetworkMainnet, NetworkTestnet, Ox,
    zecAddressFromHex, zecAddressToHex,
} from "../../src";
import { btcAddressFromHex, btcAddressToHex, createBTCAddress } from "../../src/blockchain/btc";

chai.use((chaiBigNumber)(BigNumber));
chai.should();

describe("btc.ts", () => {
    describe("createBTCAddress", async () => {
        [
            { network: NetworkMainnet, expected: "3GhPbsey6igoAf99Akhjq97pKgQkDSv9fA", get hex() { return Ox(decode(this.expected)); } },
            { network: NetworkTestnet, expected: "2N4rtJpMggc72XKvHRQYoyyTKHkkPrCNEkv", get hex() { return Ox(decode(this.expected)); } },
            { network: NetworkDevnet, expected: "2N29UCjbtgQPCa67d1qFPYciusV4w7yEwhn", get hex() { return Ox(decode(this.expected)); } },
            { network: NetworkLocalnet, expected: "2NDzLJ2KMJYmFKw1HLs4v9Q98CpFCFieYaF", get hex() { return Ox(decode(this.expected)); } },

            // Segwit
            { network: NetworkMainnet, actual: "bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9", hex: "0x626331716337736c7266786b6b6e716371326a657676766b64677672743830383038353264666a6577646534353078646c6b3475677037737a7735746b39c8af1dac" },
            { network: NetworkMainnet, actual: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", hex: "0x62633171617230737272723778666b7679356c3634336c79646e77397265353967747a7a7766356d64710ead9977" },
            { network: NetworkMainnet, actual: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", hex: "0x6263317177353038643671656a7874646734793572337a6172766172793063357877376b76386633743484fa1da3" },
            { network: NetworkTestnet, actual: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", hex: "0x7462317177353038643671656a7874646734793572337a6172766172793063357877376b78706a7a7378fbdb81ce" },
        ]
            .forEach(({ network, expected, hex, actual }) => {
                it(network.name, async () => {
                    if (expected) {
                        const address = createBTCAddress(network, "0x1234");
                        address.should.equal(expected);
                        createBTCAddress(network, "1234")
                            .should.equal(address);
                    }
                    expected = expected || actual;
                    btcAddressToHex(expected)
                        .should.equal(hex);

                    btcAddressFromHex(hex)
                        .should.equal(expected);
                });
            });
    });
});

describe("zec.ts", () => {
    describe("createBTCAddress", async () => {
        [
            { network: NetworkMainnet, expected: "t3ZZzcD5753UPmJC37BWrxxDjaLbq2Mqw6E", get hex() { return Ox(decode(this.expected)); } },
            { network: NetworkTestnet, expected: "t2JAUJ5wvuvzeTsvNcSk73TkcSYxUeXnGuh", get hex() { return Ox(decode(this.expected)); } },
            { network: NetworkDevnet, expected: "t2FT4C1C8ujGpWe7iCsSgc72D2HH1y9TRmS", get hex() { return Ox(decode(this.expected)); } },
            { network: NetworkLocalnet, expected: "t2THvHHubXsesGV1NXuGDCtSRMcTHD8cch6", get hex() { return Ox(decode(this.expected)); } },
        ]
            .forEach(({ network, expected, hex }) => {
                it(network.name, async () => {
                    const address = createZECAddress(network, "0x1234");
                    address.should.equal(expected);
                    createZECAddress(network, "1234")
                        .should.equal(address);
                    zecAddressToHex(address)
                        .should.equal(hex);

                    zecAddressFromHex(hex)
                        .should.equal(expected);
                });
            });
    });
});
