/* eslint-disable no-console */

import chai, { expect } from "chai";

import { Ethereum } from "../src/ethereum";

chai.should();

// const address = "0x" + "00".repeat(20);
// const txHash = "0x" + "00".repeat(32);

describe("Utils", () => {
    it("validateTransaction", () => {
        const ethereum = new Ethereum({
            network: "testnet",
            provider: { _isProvider: true } as any,
        });

        expect(
            ethereum.validateTransaction({
                txidFormatted:
                    "0xf7dbf98bcebd7b803917e00e7e3292843a4b7bf66016638811cea4705a32d73e",
            }),
        ).to.be.true;

        expect(
            ethereum.validateTransaction({
                txidFormatted:
                    "0xf7dbf98bcebd7b803917e00e7e3292843a4b7bf66016638811cea4705a32d73e",
                txid: "99v5i869e4A5F-AOfjKShDpLe_ZgFmOIEc6kcFoy1z4",
                txindex: "0",
            }),
        ).to.be.true;
    });
});

// describe("Explorer links", () => {
//     it("Mainnet", () => {
//         const bsc = new BinanceSmartChain(null, "mainnet");

//         for (const obj of [BinanceSmartChain, bsc]) {
//             obj.utils
//                 .addressExplorerLink(address)
//                 .should.equal("https://bscscan.com/address/" + address);

//             obj.utils
//                 .transactionExplorerLink(txHash)
//                 .should.equal("https://bscscan.com/tx/" + txHash);
//         }
//     });

//     it("Testnet", () => {
//         const bsc = new BinanceSmartChain(null, "testnet");

//         bsc.utils
//             .addressExplorerLink(address)
//             .should.equal("https://testnet.bscscan.com/address/" + address);

//         bsc.utils
//             .transactionExplorerLink(txHash)
//             .should.equal("https://testnet.bscscan.com/tx/" + txHash);

//         BinanceSmartChain.utils
//             .addressExplorerLink(address, "testnet")
//             .should.equal("https://testnet.bscscan.com/address/" + address);

//         BinanceSmartChain.utils
//             .transactionExplorerLink(txHash, "testnet")
//             .should.equal("https://testnet.bscscan.com/tx/" + txHash);
//     });
// });
