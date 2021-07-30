import { payloadToABI, payloadToMintABI } from "../src/abi";
import chai from "chai";

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
                outputs: [],
            },
        ];

        payloadToABI("functionName", [
            { name: "_spender", type: "address", value: "ethereum.eth" },
            { name: "_value", type: "uint256", value: 1 },
        ]).should.deep.eq(expectedABI);
    });

    it("payloadToMintABI", () => {
        const expectedABI = [
            {
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
            },
        ];

        payloadToMintABI("functionName", [
            { name: "_spender", type: "address", value: "ethereum.eth" },
            { name: "_value", type: "uint256", value: 1 },
        ]).should.deep.eq(expectedABI);
    });
});
