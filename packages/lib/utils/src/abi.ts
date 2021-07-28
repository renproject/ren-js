import { AbiInput, AbiItem } from "@renproject/interfaces";

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

const tupleRegex = /tuple\(([a-zA-Z0-9]+(,[a-zA-Z0-9]+)*)\)/;

/**
 * If the type of an Ethereum arg matches `tuple(...)`, then it needs to include
 * a `components` array that provides the name and type of each of the tuple's
 * values. If it wasn't included, `fixTuple` will create the components array.
 */
const fixTuple = (argument: {
    type: string;
    name: string;
    value: unknown;
    components?: AbiInput[];
}) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { value, ...args } = argument;
    try {
        // If type is `tuple(...)` but components haven't been
        // been passed in, add them.
        const match = args && args.type && tupleRegex.exec(args.type);
        if (match && !argument.components) {
            const types = match[1].split(",");
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
    payload: Array<{ type: string; name: string; value: unknown }> | undefined,
): AbiItem[] => {
    // Type validation
    assertType<string>("string", { methodName });
    (payload || []).map(({ type, name }) =>
        assertType<string>("string", { type, name }),
    );

    return [
        {
            name: methodName,
            type: "function",
            inputs: [
                ...(payload || []).map(fixTuple).map((value) => ({
                    type: value.type,
                    name: value.name,
                    ...(value.components
                        ? {
                              components: value.components,
                          }
                        : undefined),
                })),
            ],
            outputs: [],
        },
    ];
};

export const payloadToMintABI = (
    methodName: string,
    payload: Array<{ type: string; name: string; value: unknown }> | undefined,
): AbiItem[] => {
    // Type validation
    assertType<string>("string", { methodName });
    (payload || []).map(({ type, name }) =>
        assertType<string>("string", { type, name }),
    );

    return [
        {
            ...mintABITemplate,
            name: methodName,
            inputs: [
                ...(payload || []).map(fixTuple).map((value) => ({
                    type: value.type,
                    name: value.name,
                    ...(value.components
                        ? {
                              components: value.components,
                          }
                        : undefined),
                })),
                ...(mintABITemplate.inputs ? mintABITemplate.inputs : []),
            ],
        },
    ];
};
