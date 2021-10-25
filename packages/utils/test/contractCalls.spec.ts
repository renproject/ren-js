import { expect } from "chai";

import { ContractCall } from "@renproject/utils";

import {
    OverrideContractCallError,
    overrideContractCalls,
} from "../src/contractCalls";

describe("overrideContractCalls", () => {
    const testCase: ContractCall = {
        sendTo: "1",
        contractFn: "1",
        contractParams: [
            {
                name: "1",
                type: "uint256",
                value: "1",
            },
            {
                name: "2",
                type: "uint256",
                value: "2",
            },
        ],
        txConfig: { gas: 1 },
    };

    it("can override contract calls", () => {
        expect(
            overrideContractCalls([testCase], {
                sendTo: "2",
            }),
        ).to.equal([{ ...testCase, sendTo: "2" }]);

        expect(
            overrideContractCalls(
                [testCase, testCase],
                [
                    {
                        sendTo: "2",
                    },
                    {
                        sendTo: "3",
                    },
                ],
            ),
        ).to.equal([
            { ...testCase, sendTo: "2" },
            { ...testCase, sendTo: "3" },
        ]);

        expect(
            overrideContractCalls([testCase], {
                txConfig: { gasPrice: 1 },
            }),
        ).to.equal([{ ...testCase, txConfig: { gas: 1, gasPrice: 1 } }]);

        expect(
            overrideContractCalls([testCase], {
                contractParams: [
                    {
                        name: "1",
                        type: "uint256",
                        value: "11",
                    },
                ],
            }),
        ).to.equal([
            {
                ...testCase,
                contractParams: [
                    {
                        name: "1",
                        type: "uint256",
                        value: "11",
                    },
                    {
                        name: "2",
                        type: "uint256",
                        value: "2",
                    },
                ],
            },
        ]);
    });

    it("checks for invalid inputs", () => {
        expect(() =>
            overrideContractCalls(
                [testCase, testCase],
                [
                    {
                        sendTo: "2",
                    },
                ],
            ),
        ).toThrow(OverrideContractCallError.OverrideArrayLengthError);
    });
});
