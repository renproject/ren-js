import { renTestnet } from "@renproject/contracts";
import { RenContract } from "@renproject/interfaces";
import {
    processBurnAndReleaseParams,
    processLockAndMintParams,
    resolveSendCall,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import Web3 from "web3";

chai.use(chaiBigNumber(BigNumber));
chai.should();

require("dotenv").config();

describe("processParams", () => {
    let web3: Web3;

    before(() => {
        web3 = new Web3(`https://kovan.infura.io/v3/${process.env.INFURA_KEY}`);
    });

    it("Burn", () => {
        processBurnAndReleaseParams(renTestnet, {
            sendToken: "BTC",
            ethereumTxHash: "ethereumTxHash",
        }).should.deep.equal(
            { sendToken: "BTC0Eth2Btc", ethereumTxHash: "ethereumTxHash" },
            "Burn 1",
        );

        processBurnAndReleaseParams(renTestnet, {
            sendToken: "BTC",
            burnReference: 1,
        }).should.deep.equal(
            { sendToken: "BTC0Eth2Btc", burnReference: 1 },
            "Burn 2",
        );

        processBurnAndReleaseParams(renTestnet, {
            sendToken: "BTC",
            web3Provider: {},
            contractCalls: [
                {
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [
                        { name: "name", type: "uint", value: "1" },
                    ],
                    txConfig: { gas: 2 },
                },
            ],
        }).should.deep.equal(
            {
                sendToken: "BTC0Eth2Btc",
                web3Provider: {},
                contractCalls: [
                    {
                        sendTo: "sendTo",
                        contractFn: "contractFn",
                        contractParams: [
                            { name: "name", type: "uint", value: "1" },
                        ],
                        txConfig: { gas: 2 },
                    },
                ],
            },
            "Burn 3",
        );

        JSON.stringify(
            resolveSendCall(renTestnet, {
                sendToken: RenContract.Eth2Btc,
                web3Provider: web3.currentProvider,
                sendTo: "sendTo",
                sendAmount: "0",
            }),
        ).should.equal(
            JSON.stringify({
                sendToken: "BTC0Eth2Btc",
                web3Provider: web3.currentProvider,
                suggestedAmount: "0",
                contractCalls: [
                    {
                        sendTo: "0x55363c0dBf97Ff9C0e31dAfe0fC99d3e9ce50b8A",
                        contractFn: "burn",
                        contractParams: [
                            {
                                type: "bytes",
                                name: "_to",
                                value: "0x73656e64546f",
                            },
                            {
                                type: "uint256",
                                name: "_amount",
                                value: "0",
                            },
                        ],
                    },
                ],
            }),
            "Burn 4",
        );
    });

    it("Mint", () => {
        processLockAndMintParams(renTestnet, {
            sendToken: "BTC",
            txHash: "txHash",
            contractCalls: [
                {
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [
                        { name: "name", type: "address", value: "1" },
                    ],
                    txConfig: { gas: 2 },
                },
            ],
        }).should.deep.equal({
            sendToken: "BTC0Btc2Eth",
            txHash: "txHash",
            contractCalls: [
                {
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [
                        { name: "name", type: "address", value: "1" },
                    ],
                    txConfig: { gas: 2 },
                },
            ],
        });

        processLockAndMintParams(renTestnet, {
            sendToken: "BTC",
            txHash: "txHash",
            contractCalls: [
                {
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [
                        { name: "name", type: "address", value: "1" },
                    ],
                    txConfig: { gas: 2 },
                },
            ],
        }).should.deep.equal({
            sendToken: "BTC0Btc2Eth",
            txHash: "txHash",
            contractCalls: [
                {
                    sendTo: "sendTo",
                    contractFn: "contractFn",
                    contractParams: [
                        { name: "name", type: "address", value: "1" },
                    ],
                    txConfig: { gas: 2 },
                },
            ],
        });

        resolveSendCall(renTestnet, {
            sendToken: RenContract.Btc2Eth,
            txHash: "txHash",
            sendTo: "sendTo",
            sendAmount: "0.01",
            txConfig: { gas: 2 },
        }).should.deep.equal({
            sendToken: "BTC0Btc2Eth",
            txHash: "txHash",
            suggestedAmount: "0.01",
            contractCalls: [
                {
                    sendTo: "0x7DDFA2e5435027f6e13Ca8Db2f32ebd5551158Bb",
                    contractFn: "mint",
                    contractParams: [
                        {
                            name: "_symbol",
                            type: "string",
                            value: "BTC",
                        },
                        {
                            name: "_address",
                            type: "address",
                            value: "sendTo",
                        },
                    ],
                    txConfig: { gas: 2 },
                },
            ],
        });
    });
});
