import { AbiInput, AbiItem, EthArg, EthArgs } from "@renproject/interfaces";

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

// tslint:disable-next-line: no-any
const fixTuple = (argument: EthArg<string, string, any>) => {
    const { value, ...args } = argument;
    try {
        // If type is `tuple(...)` but components haven't been
        // been passed in, add them.
        const match =
            args &&
            args.type &&
            args.type.match(/tuple\(([a-zA-Z0-9]+)(?:,([a-zA-Z0-9]+))*\)/);
        if (match && !argument.components) {
            const types = match.slice(1);
            const components: AbiInput[] = [];
            for (let i = 0; i < types.length; i++) {
                components[i] = {
                    name: String(i),
                    type: types[i],
                };
            }
            return {
                ...args,
                components,
            };
        }
    } catch (error) {
        console.error(error);
    }
    return args;
};

export const payloadToABI = (
    methodName: string,
    payload: EthArgs | undefined
): AbiItem[] => {
    return [
        {
            name: methodName,
            type: "function",
            inputs: [...(payload || []).map(fixTuple)],
            outputs: [],
        },
    ];
};

export const payloadToMintABI = (
    methodName: string,
    payload: EthArgs | undefined
): AbiItem[] => {
    return [
        {
            ...mintABITemplate,
            name: methodName,
            inputs: [
                ...(payload || []).map(fixTuple),
                ...(mintABITemplate.inputs ? mintABITemplate.inputs : []),
            ],
        },
    ];
};
