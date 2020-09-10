import { AbiItem, EthType } from "@renproject/interfaces";

import { assertType } from "./assert";

const mintABITemplate: AbiItem = {
    constant: false,
    inputs: [
        {
            name: "_amount",
            type: "uint256",
        },
        {
            name: "_nHash",
            type: "bytes32",
        },
        {
            name: "_sig",
            type: "bytes",
        },
    ],
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
};

export const payloadToABI = (
    methodName: string,
    payload: Array<{ type: string; name: string }> | undefined
): AbiItem[] => {
    // Type validation
    assertType("string", { methodName });
    (payload || []).map(({ type, name }) =>
        assertType("string", { type, name })
    );

    return [
        {
            name: methodName,
            type: "function",
            inputs: [
                ...(payload || []).map((value) => ({
                    type: value.type as EthType,
                    name: value.name,
                })),
            ],
            outputs: [],
        },
    ];
};

export const payloadToMintABI = (
    methodName: string,
    payload: Array<{ type: string; name: string }> | undefined
): AbiItem[] => {
    // Type validation
    assertType("string", { methodName });
    (payload || []).map(({ type, name }) =>
        assertType("string", { type, name })
    );

    return [
        {
            ...mintABITemplate,
            name: methodName,
            inputs: [
                ...(payload || []).map((value) => ({
                    type: value.type as EthType,
                    name: value.name,
                })),
                ...(mintABITemplate.inputs ? mintABITemplate.inputs : []),
            ],
        },
    ];
};
