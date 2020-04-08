import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import Web3 from "web3";
import {
    NetworkTestnet, processBurnAndReleaseParams, processLockAndMintParams, resolveSendCall,
} from "@renproject/utils";

chai.use((chaiBigNumber)(BigNumber));
chai.should();

require("dotenv").config();

describe("processParams", () => {
    let web3: Web3;

    before(() => {
        web3 = new Web3(`https://kovan.infura.io/v3/${process.env.INFURA_KEY}`);
    });

    it("Shift out", () => {
        processBurnAndReleaseParams(NetworkTestnet, {
            sendToken: "BTC",
            ethTxHash: "ethTxHash",
        })
            .should.deep.equal({ sendToken: "BTC0Eth2Btc", ethTxHash: "ethTxHash" });

        processBurnAndReleaseParams(NetworkTestnet, {
            sendToken: "BTC",
            burnReference: 1,
        })
            .should.deep.equal({ sendToken: "BTC0Eth2Btc", burnReference: 1 });

        processBurnAndReleaseParams(NetworkTestnet, {
            sendToken: "BTC",
            web3Provider: {},
            contractCalls: [{
                sendTo: "sendTo",
                contractFn: "contractFn",
                contractParams: [{ name: "name", type: "uint", value: "1" }],
                txConfig: { gas: 2 },
            }],
        })
            .should.deep.equal({
                sendToken: "BTC0Eth2Btc",
                web3Provider: {},
                contractCalls: [{
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [{ name: "name", type: "uint", value: "1" }],
                    txConfig: { gas: 2 },
                }],
            });

        JSON.stringify(resolveSendCall(NetworkTestnet, {
            sendToken: "BTC",
            web3Provider: web3.currentProvider,
            sendTo: "sendTo",
            sendAmount: "0",
        }))
            .should.equal(JSON.stringify({
                sendToken: "BTC0Eth2Btc",
                web3Provider: web3.currentProvider,
                contractCalls: [
                    async (_w3: Web3) => new Promise((resolve) => { resolve(); }),
                    {
                        sendTo: "0x141E3A8E46a68fFA453177700732CA2764Bd8aD9",
                        contractFn: "burn",
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
        processLockAndMintParams(NetworkTestnet, {
            sendToken: "BTC",
            renTxHash: "renTxHash",
            contractCalls: [{
                sendTo: "sendTo",
                contractFn: "contractFn",
                contractParams: [{ name: "name", type: "address", value: "1" }],
                txConfig: { gas: 2 },
            }],
        })
            .should.deep.equal({
                sendToken: "BTC0Btc2Eth",
                renTxHash: "renTxHash",
                contractCalls: [{
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [{ name: "name", type: "address", value: "1" }],
                    txConfig: { gas: 2 },
                }],
            });

        processLockAndMintParams(NetworkTestnet, {
            sendToken: "BTC",
            renTxHash: "renTxHash",
            contractCalls: [{
                sendTo: "sendTo",
                contractFn: "contractFn",
                contractParams: [{ name: "name", type: "address", value: "1" }],
                txConfig: { gas: 2 },
            }],
        })
            .should.deep.equal({
                sendToken: "BTC0Btc2Eth",
                renTxHash: "renTxHash",
                contractCalls: [{
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [{ name: "name", type: "address", value: "1" }],
                    txConfig: { gas: 2 },
                }],
            });

        resolveSendCall(NetworkTestnet, {
            sendToken: "BTC",
            renTxHash: "renTxHash",
            sendTo: "sendTo",
            sendAmount: "0.01",
            txConfig: { gas: 2 },
        })
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
