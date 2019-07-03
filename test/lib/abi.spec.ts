import chai from "chai";

import { payloadToABI, payloadToShiftInABI } from "../../src/lib/abi";

require("dotenv").config();

chai.should();

describe("abi.ts", () => {
    it("payloadToABI", async () => {
        const expectedABI = [{
            name: "functionName",
            type: "function",
            inputs: [
                { type: "address", name: "_spender" },
                { type: "uint256", name: "_value" },
            ],
            outputs: [],
        }];

        payloadToABI("functionName", [{ name: "_spender", type: "address" }, { name: "_value", type: "uint256" }])
            .should.deep.eq(expectedABI);
    });

    it("payloadToShiftInABI", async () => {
        const expectedABI = [{
            constant: false,
            inputs: [
                { name: "_spender", type: "address" },
                { name: "_value", type: "uint256" },
                { name: "_amount", type: "uint256" },
                { name: "_nonce", type: "bytes32" },
                { name: "_sig", type: "bytes" }
            ],
            name: "functionName",
            outputs: [],
            payable: true,
            stateMutability: "payable",
            type: "function",
        }];

        payloadToShiftInABI("functionName", [{ name: "_spender", type: "address" }, { name: "_value", type: "uint256" }])
            .should.deep.eq(expectedABI);
    });
});
