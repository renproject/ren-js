import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import Web3 from "web3";

import { processParameters } from "../src/lib/processParameters";
import { NetworkTestnet } from "../src/types/networks";

chai.use((chaiBigNumber)(BigNumber));
chai.should();

describe("resolveContractCall", () => {
    let web3: Web3;

    before(() => {
        web3 = new Web3(`https://kovan.infura.io/v3/${process.env.INFURA_KEY}`);
    });

    it("Shift out", () => {
        processParameters(NetworkTestnet, {
            sendToken: "BTC",
            ethTxHash: "ethTxHash",
        }, { shiftIn: false })
            .should.deep.equal({ sendToken: "BTC0Eth2Btc", ethTxHash: "ethTxHash" });

        processParameters(NetworkTestnet, {
            sendToken: "BTC",
            burnReference: 1,
        }, { shiftIn: false })
            .should.deep.equal({ sendToken: "BTC0Eth2Btc", burnReference: 1 });

        processParameters(NetworkTestnet, {
            sendToken: "BTC",
            web3Provider: {},
            sendTo: "sendTo",
            contractFn: "contractFn",
            contractParams: [{ name: "name", type: "type", value: "1" }],
            txConfig: { gas: 2 },
        }, { shiftIn: false })
            .should.deep.equal({
                sendToken: "BTC0Eth2Btc",
                web3Provider: {},
                contractCalls: [{
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [{ name: "name", type: "type", value: "1" }],
                    txConfig: { gas: 2 },
                }],
            });

        JSON.stringify(processParameters(NetworkTestnet, {
            sendToken: "BTC",
            web3Provider: web3.currentProvider,
            sendTo: "sendTo",
            sendAmount: "0",
        }, { shiftIn: false }))
            .should.equal(JSON.stringify({
                sendToken: "BTC0Eth2Btc",
                web3Provider: web3.currentProvider,
                contractCalls: [
                    new Promise((resolve) => { resolve(); }),
                    {
                        sendTo: "0x141E3A8E46a68fFA453177700732CA2764Bd8aD9",
                        contractFn: "shiftOut",
                        contractParams: [
                            {
                                "type": "address",
                                "name": "_shifterRegistry",
                                "value": "0xbA563a8510d86dE95F5a50007E180d6d4966ad12",
                            },
                            {
                                "type": "string",
                                "name": "_symbol",
                                "value": "zBTC",
                            },
                            {
                                "type": "bytes",
                                "name": "_to",
                                "value": "0x73656e64546f",
                            },
                            {
                                "type": "uint256",
                                "name": "_amount",
                                "value": "0",
                            },
                        ],
                        txConfig: { gas: 200000 },
                    }],
            }));
    });

    it("Shift in", () => {
        processParameters(NetworkTestnet, {
            sendToken: "BTC",
            renTxHash: "renTxHash",
            sendTo: "sendTo",
            contractFn: "contractFn",
            contractParams: [{ name: "name", type: "type", value: "1" }],
            txConfig: { gas: 2 },
        }, { shiftIn: true })
            .should.deep.equal({
                sendToken: "BTC0Btc2Eth",
                renTxHash: "renTxHash",
                contractCalls: [{
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [{ name: "name", type: "type", value: "1" }],
                    txConfig: { gas: 2 },
                }],
            });

        processParameters(NetworkTestnet, {
            sendToken: "BTC",
            renTxHash: "renTxHash",
            sendTo: "sendTo",
            contractFn: "contractFn",
            contractParams: [{ name: "name", type: "type", value: "1" }],
            txConfig: { gas: 2 },
        }, { shiftIn: true })
            .should.deep.equal({
                sendToken: "BTC0Btc2Eth",
                renTxHash: "renTxHash",
                contractCalls: [{
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [{ name: "name", type: "type", value: "1" }],
                    txConfig: { gas: 2 },
                }],
            });

        processParameters(NetworkTestnet, {
            sendToken: "BTC",
            renTxHash: "renTxHash",
            sendTo: "sendTo",
            txConfig: { gas: 2 },
        }, { shiftIn: true })
            .should.deep.equal({
                sendToken: "BTC0Btc2Eth",
                renTxHash: "renTxHash",
                contractCalls: [{
                    sendTo: "0x141E3A8E46a68fFA453177700732CA2764Bd8aD9",
                    contractFn: "shiftIn",
                    contractParams: [
                        {
                            "name": "_shifterRegistry",
                            "type": "address",
                            "value": "0xbA563a8510d86dE95F5a50007E180d6d4966ad12",
                        },
                        {
                            "name": "_symbol",
                            "type": "string",
                            "value": "zBTC",
                        },
                        {
                            "name": "_address",
                            "type": "address",
                            "value": "sendTo",
                        },
                    ],
                    txConfig: { gas: 2 },
                }],
            });
    });
});
