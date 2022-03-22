import chai, { expect } from "chai";

import { payloadToABI, payloadToMintABI } from "../src/utils/abi";

chai.should();

describe("abi.ts", () => {
    it("payloadToABI", () => {
        const expectedABI = [
            {
                name: "functionName",
                type: "function",
                inputs: [
                    { type: "address", name: "_spender" },
                    { type: "uint256", name: "_value" },
                ],
                stateMutability: "payable",
                outputs: [],
            },
        ];

        payloadToABI("functionName", [
            { name: "_spender", type: "address", value: "ethereum.eth" },
            { name: "_value", type: "uint256", value: 1 },
        ]).should.deep.eq(expectedABI);
    });

    it("payloadToMintABI", () => {
        const expectedABI = {
            constant: false,
            inputs: [
                { name: "_spender", type: "address" },
                { name: "_value", type: "uint256" },
                { name: "_amount", type: "uint256" },
                { name: "_nHash", type: "bytes32" },
                { name: "_sig", type: "bytes" },
            ],
            name: "functionName",
            outputs: [],
            payable: true,
            stateMutability: "payable",
            type: "function",
        };

        payloadToMintABI("functionName", [
            { name: "_spender", type: "address", value: "ethereum.eth" },
            { name: "_value", type: "uint256", value: 1 },
        ]).should.deep.eq(expectedABI);
    });

    it("fixTuple", () => {
        expect(
            payloadToABI("methodWithTuple", [
                {
                    type: "tuple(address,uint256,address,bytes)",
                    name: "param",
                    value: [
                        "0x0000000000000000000000000000000000000000",
                        0,
                        "0x0000000000000000000000000000000000000000",
                        Buffer.from([0]),
                    ],
                },
            ])[0].inputs[0].components.length,
        ).to.equal(4);
    });
});
