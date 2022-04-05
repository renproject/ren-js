import { assertType } from "@renproject/utils";

export type AbiType = "function" | "constructor" | "event" | "fallback";
export type StateMutabilityType = "pure" | "view" | "nonpayable" | "payable";

export interface AbiItem {
    anonymous?: boolean;
    constant?: boolean;
    inputs?: AbiInput[];
    name?: string;
    outputs?: AbiOutput[];
    payable?: boolean;
    stateMutability?: StateMutabilityType;
    type: AbiType;
}

export interface AbiInput {
    name: string;
    type: EthType;
    indexed?: boolean;
    components?: AbiInput[];
    internalType?: string;
}

export interface AbiOutput {
    name: string;
    type: string;
    components?: AbiOutput[];
    internalType?: string;
}

export type EthInt =
    | "int"
    | "int8"
    | "int16"
    | "int24"
    | "int32"
    | "int40"
    | "int48"
    | "int56"
    | "int64"
    | "int72"
    | "int80"
    | "int88"
    | "int96"
    | "int104"
    | "int112"
    | "int120"
    | "int128"
    | "int136"
    | "int144"
    | "int152"
    | "int160"
    | "int168"
    | "int176"
    | "int184"
    | "int192"
    | "int200"
    | "int208"
    | "int216"
    | "int224"
    | "int232"
    | "int240"
    | "int248"
    | "int256";
export type EthUint =
    | "uint"
    | "uint8"
    | "uint16"
    | "uint24"
    | "uint32"
    | "uint40"
    | "uint48"
    | "uint56"
    | "uint64"
    | "uint72"
    | "uint80"
    | "uint88"
    | "uint96"
    | "uint104"
    | "uint112"
    | "uint120"
    | "uint128"
    | "uint136"
    | "uint144"
    | "uint152"
    | "uint160"
    | "uint168"
    | "uint176"
    | "uint184"
    | "uint192"
    | "uint200"
    | "uint208"
    | "uint216"
    | "uint224"
    | "uint232"
    | "uint240"
    | "uint248"
    | "uint256";
export type EthByte =
    | "bytes"
    | "bytes1"
    | "bytes2"
    | "bytes3"
    | "bytes4"
    | "bytes5"
    | "bytes6"
    | "bytes7"
    | "bytes8"
    | "bytes9"
    | "bytes10"
    | "bytes11"
    | "bytes12"
    | "bytes13"
    | "bytes14"
    | "bytes15"
    | "bytes16"
    | "bytes17"
    | "bytes18"
    | "bytes19"
    | "bytes20"
    | "bytes21"
    | "bytes22"
    | "bytes23"
    | "bytes24"
    | "bytes25"
    | "bytes26"
    | "bytes27"
    | "bytes28"
    | "bytes29"
    | "bytes30"
    | "bytes31"
    | "bytes32";
export type EthType =
    | "address"
    | "bool"
    | "string"
    | "var"
    | EthInt
    | EthUint
    | "byte"
    | EthByte
    // Added to support tuples.
    | string;

export interface EthArg<
    name extends string = string,
    type extends EthType = EthType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valueType = any,
> {
    name: name;
    type: type;
    value: valueType;
    components?: AbiInput[];

    /**
     * `notInPayload` indicates that the parameter should be used when calling
     * the smart contract but it should not be used when calculating the
     * payload hash. This is useful for values can only be known at the time
     * of calling the contract. Note that others may be able to submit the mint
     * and set their own value, unless the contract caller is restricted somehow.
     */
    notInPayload?: boolean;

    /**
     * `onlyInPayload` indicates that the parameter should be used when
     * calculating the payload hash but it should not be passed in to the
     * contract call. This is useful for values that don't need to be explicitly
     * passed in to the contract, such as the contract caller.
     *
     * `notInPayload` and `onlyInPayload` can be used together to allow users to
     * update values such as exchange rate slippage, which may have updated
     * while waiting for the lock-chain confirmations - while ensuring that
     * others can't change it for them.
     */
    onlyInPayload?: boolean;

    renParam?: boolean;
}

export type EthArgs = EthArg[];

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
    } catch (error: unknown) {
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
            stateMutability: "payable",
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
): AbiItem => {
    // Type validation
    assertType<string>("string", { methodName });
    (payload || []).map(({ type, name }) =>
        assertType<string>("string", { type, name }),
    );

    return {
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
    };
};

interface ContractCall {
    chain: string;
    abi: AbiItem[];
    method: string;
    values: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [name: string]: any;
    };
    txConfig?: unknown;
}

export enum OverrideContractCallError {
    OverrideArrayLengthError = `Contract call override must be same length as contract calls array.`,
}

export const overrideContractCall = (
    contractCall: ContractCall,
    override: ContractCallOverride,
): ContractCall => {
    const overrideParams = (override.contractParams || []).reduce(
        (acc, param) => {
            if (param.name) {
                acc[param.name] = param;
            }
            return acc;
        },
        {},
    );

    let txConfig;
    if (
        typeof contractCall.txConfig === "object" &&
        typeof override.txConfig === "object"
    ) {
        txConfig = {
            ...contractCall.txConfig,
            ...override.txConfig,
        };
    } else {
        txConfig = override.txConfig || contractCall.txConfig;
    }

    return {
        ...contractCall,
        ...override,

        // Clone txConfig
        txConfig,

        // Clone contractParams
        values: {
            ...contractCall.values,
            ...overrideParams,
        },
    };
};

export type ContractCallOverride = Partial<
    Omit<ContractCall, "contractParams"> & {
        contractParams: Array<Partial<EthArg>>;
    }
>;

export const overrideContractCalls = (
    contractCalls: ContractCall[],
    override: ContractCallOverride | ContractCallOverride[],
): ContractCall[] => {
    if (Array.isArray(override) && override.length !== contractCalls.length) {
        throw new Error(OverrideContractCallError.OverrideArrayLengthError);
    }

    return contractCalls.map((contractCall, i) => {
        const contractCallOverride = Array.isArray(override)
            ? // If override is an array, there should be an array for each call.
              override[i]
            : // If there's only one override, apply it to the last contract call.
            i === contractCalls.length - 1
            ? override
            : // Default to empty object.
              {};
        return overrideContractCall(contractCall, contractCallOverride);
    });
};
