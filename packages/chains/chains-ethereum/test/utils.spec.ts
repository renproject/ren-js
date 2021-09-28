// /* eslint-disable no-console */

// import { BinanceSmartChain } from "../src/bsc";

// import chai from "chai";
// chai.should();

// const address = "0x" + "00".repeat(20);
// const txHash = "0x" + "00".repeat(32);

// describe("BSC Utils", () => {
//     describe("Explorer links", () => {
//         it("Mainnet", () => {
//             const bsc = new BinanceSmartChain(null, "mainnet");

//             for (const obj of [BinanceSmartChain, bsc]) {
//                 obj.utils
//                     .addressExplorerLink(address)
//                     .should.equal("https://bscscan.com/address/" + address);

//                 obj.utils
//                     .transactionExplorerLink(txHash)
//                     .should.equal("https://bscscan.com/tx/" + txHash);
//             }
//         });

//         it("Testnet", () => {
//             const bsc = new BinanceSmartChain(null, "testnet");

//             bsc.utils
//                 .addressExplorerLink(address)
//                 .should.equal("https://testnet.bscscan.com/address/" + address);

//             bsc.utils
//                 .transactionExplorerLink(txHash)
//                 .should.equal("https://testnet.bscscan.com/tx/" + txHash);

//             BinanceSmartChain.utils
//                 .addressExplorerLink(address, "testnet")
//                 .should.equal("https://testnet.bscscan.com/address/" + address);

//             BinanceSmartChain.utils
//                 .transactionExplorerLink(txHash, "testnet")
//                 .should.equal("https://testnet.bscscan.com/tx/" + txHash);
//         });
//     });
// });
