import { AbiItem, EthType } from "@renproject/interfaces";

const shiftInABITemplate: AbiItem = {
    constant: false,
    inputs: [
        {
            name: "_amount",
            type: "uint256"
        },
        {
            name: "_nHash",
            type: "bytes32"
        },
        {
            name: "_sig",
            type: "bytes"
        },
    ],
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
};

export const payloadToABI = (methodName: string, payload: Array<{ type: string, name: string }> | undefined): AbiItem[] => {
    return [
        {
            name: methodName,
            type: "function",
            inputs: [
                ...(payload || []).map(value => ({ type: value.type as EthType, name: value.name })),
            ],
            outputs: [],
        }
    ];
};

export const payloadToShiftInABI = (methodName: string, payload: Array<{ type: string, name: string }> | undefined): AbiItem[] => {
    return [
        {
            ...shiftInABITemplate,
            name: methodName,
            inputs: [
                ...(payload || []).map(value => ({ type: value.type as EthType, name: value.name })),
                ...(shiftInABITemplate.inputs ? shiftInABITemplate.inputs : []),
            ]
        }
    ];
};
