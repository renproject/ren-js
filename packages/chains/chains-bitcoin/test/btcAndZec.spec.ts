import chai from "chai";

// import {
//     btcAddressFrom,
//     btcAddressToHex,
//     createBCHAddress,
//     createBTCAddress,
//     createZECAddress,
// } from "@renproject/chains";

chai.should();

// describe("btc.ts", () => {
//     describe("createBTCAddress", async () => {
//         [
//             { network: NetworkMainnet, expected: "3GhPbsey6igoAf99Akhjq97pKgQkDSv9fA", get hex() { return RenJS.utils.Ox(Buffer.from(this.expected)); } },
//             { network: RenJS.NetworkDetails.NetworkTestnet, expected: "2N4rtJpMggc72XKvHRQYoyyTKHkkPrCNEkv", get hex() { return RenJS.utils.Ox(Buffer.from(this.expected)); } },
//             { network: NetworkDevnet, expected: "2N29UgPubKeyCjbtgQPCa67d1qFPYciusV4w7yEwhn", get hex() { return RenJS.utils.Ox(Buffer.from(this.expected)); } },
//             { network: NetworkLocalnet, expected: "2NDzLJ2KMJYmFKw1HLs4v9Q98CpFCFieYaF", get hex() { return RenJS.utils.Ox(Buffer.from(this.expected)); } },

//             // Segwit
//             // { network: NetworkMainnet, actual: "bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9", hex: "0x626331716337736c7266786b6b6e716371326a657676766b64677672743830383038353264666a6577646534353078646c6b3475677037737a7735746b39c8af1dac" },
//             // { network: NetworkMainnet, actual: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", hex: "0x62633171617230737272723778666b7679356c3634336c79646e77397265353967747a7a7766356d64710ead9977" },
//             // { network: NetworkMainnet, actual: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", hex: "0x6263317177353038643671656a7874646734793572337a6172766172793063357877376b76386633743484fa1da3" },
//             // { network: NetworkTestnet, actual: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", hex: "0x7462317177353038643671656a7874646734793572337a6172766172793063357877376b78706a7a7378fbdb81ce" },
//             { network: NetworkMainnet, actual: "bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9", get hex() { return RenJS.utils.Ox(Buffer.from(this.actual)); } },
//             { network: NetworkMainnet, actual: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", get hex() { return RenJS.utils.Ox(Buffer.from(this.actual)); } },
//             { network: NetworkMainnet, actual: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", get hex() { return RenJS.utils.Ox(Buffer.from(this.actual)); } },
//             { network: RenJS.NetworkDetails.NetworkTestnet, actual: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", get hex() { return RenJS.utils.Ox(Buffer.from(this.actual)); } },
//         ]
//             .forEach(({ network, expected, hex, actual }) => {
//                 it(network.name, async () => {
//                     if (expected) {
//                         const address = createBTCAddress(network.isTestnet, .network.renVM.gPubKey, "0x1234");
//                         address.should.equal(expected);
//                         createBTCAddress(network.isTestnet, .network.renVM.gPubKey, "1234")
//                             .should.equal(address);
//                     }
//                     expected = expected || actual;
//                     btcAddressToHex(expected)
//                         .should.equal(hex);

//                     btcAddressFrom(hex)
//                         .should.equal(expected);
//                 });
//             });
//     });
// });

// describe("zec.ts", () => {
//     describe("createZECAddress", async () => {
//         [
//             { network: NetworkMainnet, actual: "t1QuA61jBJTG7udadwpz4SF4o9kKDShqn4H", get hex() { return RenJS.utils.Ox(decode(this.actual)); } },
//             { network: NetworkMainnet, expected: "t3ZZzcD5753UPmJC37BWrxxDjaLbq2Mqw6E", get hex() { return RenJS.utils.Ox(decode(this.expected)); } },
//             { network: RenJS.NetworkDetails.NetworkChaosnet, expected: "t3R5RvjtAcBaZXYmMVBsuueRL4oYK2sxbss", get hex() { return RenJS.utils.Ox(decode(this.expected)); } },
//             { network: RenJS.NetworkDetails.NetworkTestnet, expected: "t2JAUJ5wvuvzeTsvNcSk73TkcSYxUeXnGuh", get hex() { return RenJS.utils.Ox(decode(this.expected)); } },
//             { network: NetworkDevnet, expected: "t2FT4C1C8ujGpWe7iCsSgc72D2HH1y9TRmS", get hex() { return RenJS.utils.Ox(decode(this.expected)); } },
//             { network: NetworkLocalnet, expected: "t2THvHHubXsesGV1NXuGDCtSRMcTHD8cch6", get hex() { return RenJS.utils.Ox(decode(this.expected)); } },
//         ]
//             .forEach(({ network, expected, actual, hex }) => {
//                 it(network.name, async () => {
//                     if (expected) {
//                         const address = createZECAddress(network.isTestnet, .network.renVM.gPubKey, "0x1234");
//                         address.should.equal(expected);
//                         createZECAddress(network.isTestnet, .network.renVM.gPubKey, "1234")
//                             .should.equal(address);
//                     }
//                     expected = expected || actual;
//                     RenJS.utils.zec.addressToHex(expected)
//                         .should.equal(hex);

//                     RenJS.utils.zec.addressFrom(hex)
//                         .should.equal(expected);
//                 });
//             });
//     });
// });

// describe("bch.ts", () => {
//     describe("createBCHAddress", async () => {
//         [
//             { network: NetworkMainnet, expected: "bitcoincash:pzjfh7u52490nrgkw8jryhkjnf462vvsjc00elh6h4", get hex() { return RenJS.utils.Ox(Buffer.from(this.expected)); } },
//             { network: RenJS.NetworkDetails.NetworkChaosnet, expected: "bitcoincash:pprhgry6947my4gn4j53ht30n5ne9t2q0cg5hp72na", get hex() { return RenJS.utils.Ox(Buffer.from(this.expected)); } },
//             { network: RenJS.NetworkDetails.NetworkTestnet, expected: "bchtest:pplk0msfzrwy920zlnvsjjtkwf7hv0hpzyc9vu8h7c", get hex() { return RenJS.utils.Ox(Buffer.from(this.expected)); } },
//             { network: NetworkDevnet, expected: "bchtest:pps69qyfn8xx4w95xgyupkyy04wwjhgw4qlw8kx58p", get hex() { return RenJS.utils.Ox(Buffer.from(this.expected)); } },
//             { network: NetworkLocalnet, expected: "bchtest:pr3cn2ncz0xm2kmk79n0zfwcafdcvg6dashfp5llk3", get hex() { return RenJS.utils.Ox(Buffer.from(this.expected)); } },
//         ]
//             .forEach(({ network, expected, hex }) => {
//                 it(network.name, async () => {
//                     const address = createBCHAddress(network.isTestnet, .network.renVM.gPubKey, "0x1234");
//                     address.should.equal(expected);
//                     createBCHAddress(network.isTestnet, .network.renVM.gPubKey, "1234")
//                         .should.equal(address);
//                     RenJS.utils.bch.addressToHex(address)
//                         .should.equal(hex);

//                     RenJS.utils.bch.addressFrom(hex)
//                         .should.equal(expected);
//                 });
//             });
//     });
// });
