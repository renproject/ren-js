import { AbiItem } from "web3-utils";

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

export const payloadToABI = (methodName: string, payload: Array<{ type: string, name: string }>): AbiItem[] => {
    return [
        {
            name: methodName,
            type: "function",
            inputs: [
                ...payload.map(value => ({ type: value.type, name: value.name })),
            ],
            outputs: [],
        }
    ];
};

export const payloadToShiftInABI = (methodName: string, payload: Array<{ type: string, name: string }>): AbiItem[] => {
    return [
        {
            ...shiftInABITemplate,
            name: methodName,
            inputs: [
                ...payload.map(value => ({ type: value.type, name: value.name })),
                // tslint:disable-next-line: no-non-null-assertion
                ...shiftInABITemplate.inputs!,
            ]
        }
    ];
};
