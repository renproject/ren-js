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
                { type: "address", name: "spender" },
                { type: "uint256", name: "value" },
            ],
            outputs: [],
        }];

        payloadToABI("functionName", [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }])
            .should.deep.eq(expectedABI);
    });

    it("payloadToShiftInABI", async () => {
        const expectedABI = [{
            constant: false,
            inputs: [
                { type: "address", name: "spender" },
                { type: "uint256", name: "value" },
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

        payloadToShiftInABI("functionName", [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }])
            .should.deep.eq(expectedABI);
    });
});
