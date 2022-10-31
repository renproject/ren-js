/* eslint-disable no-console */

import chai, { expect } from "chai";
import { providers } from "ethers";

import { EthProvider } from "../src";
import { Ethereum } from "../src/ethereum";
import { resolveRpcEndpoints } from "../src/utils/generic";

chai.should();

// const address = "0x" + "00".repeat(20);
// const txHash = "0x" + "00".repeat(32);

describe("Ethereum utils", () => {
    it("addressIsValid", () => {
        const ethereum = new Ethereum({
            network: "testnet",
            defaultTestnet: "goerli",
            provider: new providers.JsonRpcProvider(
                Ethereum.configMap["testnet"].config.rpcUrls[0],
            ),
        });

        expect(
            ethereum.validateAddress(
                "0x05a56E2D52c817161883f50c441c3228CFe54d9f",
            ),
        ).to.equal(true);

        expect(
            ethereum.validateAddress(
                "0x05a56e2d52c817161883f50c441c3228cfe54d9f",
            ),
        ).to.equal(true);

        // ENS domain
        expect(ethereum.validateAddress("vitalik.eth")).to.equal(true);

        // Bad casing

        expect(
            ethereum.validateAddress(
                "0x05a56E2D52c817161883f50c441c3228CFe54d9F",
            ),
        ).to.equal(false);

        // Too short.
        expect(ethereum.validateAddress("0x05a56E2D52c81")).to.equal(false);

        // Not an ENS domain
        expect(ethereum.validateAddress("vitalik.ethos")).to.equal(false);
    });
});

describe("Utils", () => {
    it("validateTransaction", () => {
        const ethereum = new Ethereum({
            network: "testnet",
            defaultTestnet: "goerli",
            provider: { _isProvider: true } as unknown as EthProvider,
        });

        expect(
            ethereum.validateTransaction({
                txHash: "0xf7dbf98bcebd7b803917e00e7e3292843a4b7bf66016638811cea4705a32d73e",
            }),
        ).to.be.true;

        expect(
            ethereum.validateTransaction({
                txHash: "0xf7dbf98bcebd7b803917e00e7e3292843a4b7bf66016638811cea4705a32d73e",
                txid: "99v5i869e4A5F-AOfjKShDpLe_ZgFmOIEc6kcFoy1z4",
                txindex: "0",
            }),
        ).to.be.true;
    });

    it("resolveRpcEndpoints", () => {
        expect(
            resolveRpcEndpoints(
                [
                    "https://test.com/${TEST}",
                    "https://test2.com/${MISSING}",
                    "wss://test3.com",
                ],
                { TEST: "test" },
            ),
        ).to.deep.equal(["https://test.com/test"]);

        expect(
            resolveRpcEndpoints(
                [
                    "https://test.com/${TEST}",
                    "https://test2.com/${MISSING}",
                    "wss://test3.com/${TEST}",
                ],
                { TEST: "test" },
                "wss",
            ),
        ).to.deep.equal(["wss://test3.com/test"]);
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
