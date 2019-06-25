import { AbiItem } from "web3-utils";

import { Payload } from "./utils";

const shiftInABITemplate: AbiItem = {
    constant: false,
    inputs: [
        {
            name: "_amount",
            type: "uint256"
        },
        {
            name: "_nonce",
            type: "bytes32"
        },
        {
            name: "_sig",
            type: "bytes"
        },
    ],
    name: "shiftIn",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function"
};

export const payloadToABI = (methodName: string, payload: Payload): AbiItem[] => {
    return [
        {
            ...shiftInABITemplate,
            name: methodName,
            inputs: [
                // tslint:disable-next-line: no-non-null-assertion
                ...shiftInABITemplate.inputs!,
                ...payload.map(value => ({ type: value.type, name: "_address" })),
            ]
        }
    ];
};