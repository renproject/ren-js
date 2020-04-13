import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import Web3 from "web3";
import {
    NetworkTestnet, processBurnAndReleaseParams, processLockAndMintParams, resolveSendCall,
} from "@renproject/utils";
import { RenContract } from "@renproject/interfaces";

chai.use((chaiBigNumber)(BigNumber));
chai.should();

require("dotenv").config();

describe("processParams", () => {
    let web3: Web3;

    before(() => {
        web3 = new Web3(`https://kovan.infura.io/v3/${process.env.INFURA_KEY}`);
    });

    it("Burn", () => {
        processBurnAndReleaseParams(NetworkTestnet, {
            sendToken: "BTC",
            ethTxHash: "ethTxHash",
        })
            .should.deep.equal({ sendToken: "BTC0Eth2Btc", ethTxHash: "ethTxHash" }, "Burn 1");

        processBurnAndReleaseParams(NetworkTestnet, {
            sendToken: "BTC",
            burnReference: 1,
        })
            .should.deep.equal({ sendToken: "BTC0Eth2Btc", burnReference: 1 }, "Burn 2");

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
            }, "Burn 3");

        JSON.stringify(resolveSendCall(NetworkTestnet, {
            sendToken: RenContract.Eth2Btc,
            web3Provider: web3.currentProvider,
            sendTo: "sendTo",
            sendAmount: "0",
        }))
            .should.equal(JSON.stringify({
                sendToken: "BTC0Eth2Btc",
                web3Provider: web3.currentProvider,
                suggestedAmount: "0",
                contractCalls: [
                    {
                        sendTo: "0x141E3A8E46a68fFA453177700732CA2764Bd8aD9",
                        contractFn: "burn",
                        contractParams: [
                            {
                                "type": "address",
                                "name": "_gatewayRegistry",
                                "value": "0xbA563a8510d86dE95F5a50007E180d6d4966ad12",
                            },
                            {
                                "type": "string",
                                "name": "_symbol",
                                "value": "BTC",
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
                        ]
                    }],
            }), "Burn 4");
    });

    it("Mint", () => {
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
            sendToken: RenContract.Btc2Eth,
            renTxHash: "renTxHash",
            sendTo: "sendTo",
            sendAmount: "0.01",
            txConfig: { gas: 2 },
        })
            .should.deep.equal({
                sendToken: "BTC0Btc2Eth",
                renTxHash: "renTxHash",
                suggestedAmount: "0.01",
                contractCalls: [{
                    sendTo: "0x7DDFA2e5435027f6e13Ca8Db2f32ebd5551158Bb",
                    contractFn: "mint",
                    contractParams: [
                        {
                            "name": "_symbol",
                            "type": "string",
                            "value": "BTC",
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
