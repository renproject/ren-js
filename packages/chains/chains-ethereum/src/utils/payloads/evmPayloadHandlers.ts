import {
    ChainTransaction,
    ErrorWithCode,
    InputType,
    OutputType,
    RenJSError,
    SyncOrPromise,
    utils,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import {
    Contract,
    ethers,
    PayableOverrides,
    PopulatedTransaction,
    Signer,
} from "ethers";
import { ParamType } from "ethers/lib/utils";

import { getERC20Instance } from "../../contracts";
import { EthArg, payloadToABI } from "../abi";
import { fixEVMTransactionConfig } from "../evmTxSubmitter";
import { rawEncode } from "../generic";
import { EVMNetworkConfig } from "../types";

export enum EVMParam {
    // Always available

    EVM_INPUT_TYPE = "__EVM_INPUT_TYPE__",
    EVM_OUTPUT_TYPE = "__EVM_OUTPUT_TYPE__",
    // For output transactions, the same as EVM_OUTPUT_TYPE, and for input
    // transactions the same as EVM_INPUT_TYPE.
    EVM_TRANSACTION_TYPE = "__EVM_TRANSACTION_TYPE__",

    EVM_TOKEN_ADDRESS = "__EVM_TOKEN_ADDRESS__",
    EVM_TOKEN_DECIMALS = "__EVM_TOKEN_DECIMALS__",
    EVM_GATEWAY_IS_DEPOSIT_ASSET = "__EVM_GATEWAY_IS_DEPOSIT_ASSET__",
    EVM_GATEWAY_DEPOSIT_ADDRESS = "__EVM_GATEWAY_DEPOSIT_ADDRESS__",
    EVM_TRANSFER_WITH_LOG_CONTRACT = "__EVM_TRANSFER_WITH_LOG_CONTRACT__",
    EVM_ACCOUNT = "__EVM_ACCOUNT__",
    EVM_ACCOUNT_IS_CONTRACT = "__EVM_ACCOUNT_IS_CONTRACT__",
    EVM_GATEWAY = "__EVM_GATEWAY__",
    EVM_ASSET = "__EVM_ASSET__",
    EVM_CHAIN = "__EVM_CHAIN__",

    // Available when minting or releasing
    EVM_AMOUNT = "__EVM_AMOUNT__",
    EVM_NHASH = "__EVM_NHASH__",
    EVM_PHASH = "__EVM_PHASH__",
    EVM_SIGNATURE = "__EVM_SIGNATURE__",
    EVM_SIGNATURE_R = "__EVM_SIGNATURE_R__",
    EVM_SIGNATURE_S = "__EVM_SIGNATURE_S__",
    EVM_SIGNATURE_V = "__EVM_SIGNATURE_V__",

    // Available when locking or burning
    EVM_TO_CHAIN = "__EVM_TO_CHAIN__",
    EVM_TO_ADDRESS = "__EVM_TO_ADDRESS__",
    EVM_TO_ADDRESS_BYTES = "__EVM_TO_ADDRESS_BYTES__",
    EVM_TO_PAYLOAD = "__EVM_TO_PAYLOAD__",
}

export type EVMParamValues = {
    // Always available.
    [EVMParam.EVM_INPUT_TYPE]: "lock" | "burn";
    [EVMParam.EVM_OUTPUT_TYPE]: "mint" | "release";
    [EVMParam.EVM_TRANSACTION_TYPE]:
        | "setup"
        | "lock"
        | "mint"
        | "release"
        | "burn";
    [EVMParam.EVM_TOKEN_ADDRESS]: () => Promise<string>;
    [EVMParam.EVM_TOKEN_DECIMALS]: () => Promise<number>;
    [EVMParam.EVM_TRANSFER_WITH_LOG_CONTRACT]: () => Promise<string>;
    [EVMParam.EVM_ACCOUNT]: () => Promise<string | undefined>;
    [EVMParam.EVM_ACCOUNT_IS_CONTRACT]: () => Promise<boolean | undefined>;
    [EVMParam.EVM_GATEWAY]: () => Promise<string>;
    [EVMParam.EVM_ASSET]: string;
    [EVMParam.EVM_CHAIN]?: string;

    // Available when minting or releasing.
    [EVMParam.EVM_AMOUNT]?: string; // in wei
    [EVMParam.EVM_NHASH]?: Uint8Array;
    [EVMParam.EVM_PHASH]?: Uint8Array;
    [EVMParam.EVM_SIGNATURE]?: Uint8Array;
    [EVMParam.EVM_SIGNATURE_R]?: Uint8Array;
    [EVMParam.EVM_SIGNATURE_S]?: Uint8Array;
    [EVMParam.EVM_SIGNATURE_V]?: number;

    // Available when locking or burning.
    [EVMParam.EVM_TO_CHAIN]?: string;
    [EVMParam.EVM_TO_ADDRESS]?: string;
    [EVMParam.EVM_TO_ADDRESS_BYTES]?: Uint8Array;
    [EVMParam.EVM_TO_PAYLOAD]?: Uint8Array;
    // Available when locking deposit assets (e.g. ETH on Ethereum, FTM on Fantom)
    [EVMParam.EVM_GATEWAY_IS_DEPOSIT_ASSET]?: boolean;
    [EVMParam.EVM_GATEWAY_DEPOSIT_ADDRESS]?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isEVMParam = (value: any): value is EVMParam =>
    Object.values(EVMParam).indexOf(value) >= 0;

/**
 * The configuration associated with an EVM payload.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface EVMPayloadInterface<Name extends string = string, T = any> {
    /** The name of the payload's chain. */
    chain: string;
    /** EVM transaction config overrides. */
    txConfig?: PayableOverrides;
    /** The type of EVM payload. */
    type: Name;
    /** The parameters specific to the EVM payload type. */
    params: T;
    /** Set-up transactions required by the payload.  */
    setup?: {
        [name: string]: EVMPayload;
    };

    payloadConfig?: {
        /**
         * Whether the `to` field passed to the RenVM transaction should remain
         * preserved, for resuming a transaction that was created with a
         * non-standard address format (no 0x prefix, or no checksum)
         */
        preserveAddressFormat?: boolean;
    };
}

export interface PayloadHandler<P extends EVMPayload = EVMPayload> {
    required?: (params: {
        network: EVMNetworkConfig;
        signer?: Signer;
        payload: P;
        evmParams: EVMParamValues;
        getPayloadHandler: (payloadType: string) => PayloadHandler;
    }) => SyncOrPromise<boolean>;
    getSetup?: (params: {
        network: EVMNetworkConfig;
        signer?: Signer;
        payload: P;
        evmParams: EVMParamValues;
        getPayloadHandler: (payloadType: string) => PayloadHandler;
    }) => SyncOrPromise<{
        [name: string]: EVMPayload;
    }>;
    getPayload?: (params: {
        network: EVMNetworkConfig;
        signer: Signer | undefined;
        payload: P;
        evmParams: EVMParamValues;
        getPayloadHandler: (payloadType: string) => PayloadHandler;
    }) => SyncOrPromise<{
        to: string;
        toBytes: Uint8Array;
        payload: Uint8Array;
    }>;
    export: (params: {
        network: EVMNetworkConfig;
        signer?: Signer;
        payload: P;
        evmParams: EVMParamValues;
        overrides: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrides?: { [key: string]: any };
            txConfig?: PayableOverrides;
        };
        getPayloadHandler: (payloadType: string) => PayloadHandler;
    }) => SyncOrPromise<PopulatedTransaction>;
}

const replaceRenParam = async (
    value: unknown,
    evmParams: EVMParamValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
    let valueOrParam = isEVMParam(value) ? evmParams[value] : value;
    if (typeof valueOrParam === "function") {
        valueOrParam = await valueOrParam();
    }
    return valueOrParam;
};

// Replace contract address and parameter values with Ren parameters.
const resolveEVMContractParams = async (
    payload: EVMContractPayload,
    evmParams: EVMParamValues,
): Promise<EVMContractPayload> => {
    return {
        ...payload,
        params: {
            ...payload.params,
            to: await replaceRenParam(payload.params.to, evmParams),
            params: await Promise.all(
                payload.params.params.map(async (value) => ({
                    ...value,
                    value: await replaceRenParam(value.value, evmParams),
                })),
            ),
        },
    };
};

export type EVMContractPayload = EVMPayloadInterface<
    "contract",
    {
        to: string;
        method: string;
        params: EthArg[];
        txConfig?: PayableOverrides;
    }
>;

export const contractPayloadHandler: PayloadHandler<EVMContractPayload> = {
    getSetup: ({ payload }: { payload: EVMContractPayload }) =>
        payload.setup || {},

    getPayload: async ({
        network,
        payload,
        evmParams,
    }: {
        network: EVMNetworkConfig;
        payload: EVMContractPayload;
        evmParams: EVMParamValues;
    }): Promise<{
        to: string;
        toBytes: Uint8Array;
        payload: Uint8Array;
    }> => {
        try {
            payload = await resolveEVMContractParams(payload, evmParams);
        } catch (error: unknown) {
            throw ErrorWithCode.updateError(
                error,
                RenJSError.PARAMETER_ERROR,
                `Error getting contract-call payload`,
            );
        }

        const args = payload.params.params.filter((arg) => !arg.notInPayload);

        for (const arg of args) {
            if (arg.value === undefined) {
                if (arg.renParam) {
                    throw new ErrorWithCode(
                        `Payload parameter '${arg.name}' is undefined. (Did you accidentally set 'withRenParams' for a burn?)`,
                        RenJSError.PARAMETER_ERROR,
                    );
                }
                throw new ErrorWithCode(
                    `Payload parameter '${arg.name}' is undefined.`,
                    RenJSError.PARAMETER_ERROR,
                );
            }
        }
        if (payload.params.to === undefined) {
            throw new ErrorWithCode(
                `Payload 'to' is undefined.`,
                RenJSError.PARAMETER_ERROR,
            );
        }

        const types: ParamType[] = args.map(
            ({ value: _, ...params }) => params as ParamType,
        );
        const values = args.map((param): unknown => param.value);

        let p: Uint8Array;
        try {
            p = rawEncode(types, values);
        } catch (error: unknown) {
            throw new ErrorWithCode(
                error,
                RenJSError.PARAMETER_ERROR,
                `Error encoding ${network.selector} parameters`,
            );
        }

        return {
            to: payload.params.to,
            toBytes: utils.fromHex(payload.params.to),
            payload: p,
        };
    },

    export: async ({
        network,
        signer,
        payload,
        evmParams,
        overrides,
    }: {
        network: EVMNetworkConfig;
        signer?: Signer;
        payload: EVMContractPayload;
        evmParams: EVMParamValues;
        overrides: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrides?: { [key: string]: any };
            txConfig?: PayableOverrides;
        };
    }): Promise<PopulatedTransaction> => {
        try {
            payload = await resolveEVMContractParams(payload, evmParams);
        } catch (error: unknown) {
            throw ErrorWithCode.updateError(
                error,
                RenJSError.PARAMETER_ERROR,
                `Error resolving parameters for contract-call`,
            );
        }

        // Get parameter values, checking first if each value has been
        // overridden.
        const params = payload.params.params.map((x) =>
            overrides.overrides && utils.isDefined(overrides.overrides[x.name])
                ? {
                      ...x,
                      value: overrides.overrides[x.name],
                  }
                : x,
        );
        const paramTypes: ParamType[] = params.map(
            ({ value: _value, ...paramABI }) => paramABI as ParamType,
        );
        const paramValues = params.map((x) => x.value);

        for (const param of params) {
            if (param.value === undefined) {
                throw ErrorWithCode.updateError(
                    new Error(`Parameter '${param.name}' is undefined.`),
                    RenJSError.PARAMETER_ERROR,
                );
            }
        }

        try {
            rawEncode(paramTypes, paramValues);
        } catch (error: unknown) {
            throw new ErrorWithCode(
                error,
                RenJSError.PARAMETER_ERROR,
                `Error encoding ${network.selector} parameters`,
            );
        }

        const abi = payloadToABI(payload.params.method, params)[0];

        if (!abi.name) {
            throw new Error(`ABI must include method name.`);
        }

        const contract = new Contract(
            payload.params.to.toLowerCase(),
            [abi],
            signer,
        );
        return await contract.populateTransaction[abi.name](
            ...paramValues,
            fixEVMTransactionConfig(
                payload.txConfig,
                payload.params.txConfig,
                overrides.txConfig,
            ),
        );
    },
};

const getContractFromAccount = async (
    network: EVMNetworkConfig,
    payload: EVMAddressPayload,
    evmParams: EVMParamValues,
): Promise<EVMContractPayload | undefined> => {
    const amount = utils.isDefined(payload.params.amount)
        ? new BigNumber(payload.params.amount)
              .shiftedBy(
                  payload.params.convertUnit || payload.params.convertToWei
                      ? await evmParams[EVMParam.EVM_TOKEN_DECIMALS]()
                      : 0,
              )
              .toFixed()
        : undefined;
    switch (evmParams[EVMParam.EVM_TRANSACTION_TYPE]) {
        case InputType.Lock:
            if (!amount) {
                throw ErrorWithCode.updateError(
                    new Error(`Must provide amount to .Account()`),
                    RenJSError.PARAMETER_ERROR,
                );
            }
            if (evmParams[EVMParam.EVM_GATEWAY_IS_DEPOSIT_ASSET]) {
                return {
                    chain: network.selector,
                    type: "contract",
                    params: {
                        to: EVMParam.EVM_TRANSFER_WITH_LOG_CONTRACT,
                        method: "transferWithLog",
                        params: [
                            {
                                type: "address",
                                name: "to",
                                value: EVMParam.EVM_GATEWAY_DEPOSIT_ADDRESS,
                            },
                        ],
                        txConfig: {
                            value: amount,
                        },
                    },
                };
            }
            return {
                chain: network.selector,
                type: "contract",
                params: {
                    to: EVMParam.EVM_GATEWAY,
                    method: "lock",
                    params: [
                        {
                            type: "string",
                            name: "recipientAddress",
                            value: EVMParam.EVM_TO_ADDRESS,
                        },
                        {
                            type: "string",
                            name: "recipientChain",
                            value: EVMParam.EVM_TO_CHAIN,
                        },
                        {
                            type: "bytes",
                            name: "recipientPayload",
                            value: EVMParam.EVM_TO_PAYLOAD,
                        },
                        {
                            type: "uint256",
                            name: "amount",
                            value: amount,
                        },
                    ],
                },
            };
        case InputType.Burn:
            if (!amount) {
                throw ErrorWithCode.updateError(
                    new Error(`Must provide amount to .Account()`),
                    RenJSError.PARAMETER_ERROR,
                );
            }

            const toPayload =
                evmParams[EVMParam.EVM_TO_PAYLOAD] || new Uint8Array();
            if (
                evmParams[EVMParam.EVM_OUTPUT_TYPE] === "mint" ||
                toPayload.length > 0
            ) {
                return {
                    chain: network.selector,
                    type: "contract",
                    params: {
                        to: EVMParam.EVM_GATEWAY,
                        method: "burnWithPayload",
                        params: [
                            {
                                name: "recipientAddress",
                                type: "string" as const,
                                value: EVMParam.EVM_TO_ADDRESS,
                            },
                            {
                                name: "recipientChain",
                                type: "string" as const,
                                value: EVMParam.EVM_TO_CHAIN,
                            },
                            {
                                name: "recipientPayload",
                                type: "bytes" as const,
                                value: toPayload,
                            },
                            {
                                name: "amount",
                                type: "uint256" as const,
                                value: amount,
                            },
                        ],
                    },
                };
            } else {
                return {
                    chain: network.selector,
                    type: "contract",
                    params: {
                        to: EVMParam.EVM_GATEWAY,
                        method: "burn",
                        params: [
                            {
                                type: "bytes" as const,
                                name: "to",
                                value: EVMParam.EVM_TO_ADDRESS_BYTES,
                            },
                            {
                                type: "uint256" as const,
                                name: "amount",
                                value: amount,
                            },
                        ],
                    },
                };
            }
        case OutputType.Mint:
            if (payload.params.anyoneCanSubmit) {
                return {
                    chain: network.selector,
                    type: "contract",
                    params: {
                        to: network.addresses.BasicBridge,
                        method: "mint",
                        params: [
                            {
                                type: "string",
                                name: "symbol",
                                value: EVMParam.EVM_ASSET,
                            },
                            {
                                type: "address",
                                name: "recipient",
                                value: payload.params.address,
                            },
                            {
                                type: "uint256",
                                name: "amount",
                                value: EVMParam.EVM_AMOUNT,
                                notInPayload: true,
                                renParam: true,
                            },
                            {
                                type: "bytes32",
                                name: "nHash",
                                value: EVMParam.EVM_NHASH,
                                notInPayload: true,
                                renParam: true,
                            },
                            {
                                type: "bytes",
                                name: "sig",
                                value: EVMParam.EVM_SIGNATURE,
                                notInPayload: true,
                                renParam: true,
                            },
                        ],
                    },
                };
            }
            return {
                chain: network.selector,
                type: "contract",
                params: {
                    to: EVMParam.EVM_GATEWAY,
                    method: "mint",
                    params: [
                        {
                            type: "bytes32",
                            name: "pHash",
                            value: EVMParam.EVM_PHASH,
                            notInPayload: true,
                            renParam: true,
                        },
                        {
                            type: "uint256",
                            name: "amount",
                            value: EVMParam.EVM_AMOUNT,
                            notInPayload: true,
                            renParam: true,
                        },
                        {
                            type: "bytes32",
                            name: "nHash",
                            value: EVMParam.EVM_NHASH,
                            notInPayload: true,
                            renParam: true,
                        },
                        {
                            type: "bytes",
                            name: "sig",
                            value: EVMParam.EVM_SIGNATURE,
                            notInPayload: true,
                            renParam: true,
                        },
                    ],
                },
            };
        case OutputType.Release:
            if (evmParams[EVMParam.EVM_GATEWAY_IS_DEPOSIT_ASSET]) {
                return undefined;
            }
            if (payload.params.anyoneCanSubmit) {
                return {
                    chain: network.selector,
                    type: "contract",
                    params: {
                        to: network.addresses.BasicBridge,
                        method: "release",
                        params: [
                            {
                                type: "string",
                                name: "symbol",
                                value: EVMParam.EVM_ASSET,
                            },
                            {
                                type: "address",
                                name: "recipient",
                                value: payload.params.address,
                            },
                            {
                                type: "uint256",
                                name: "amount",
                                value: EVMParam.EVM_AMOUNT,
                                notInPayload: true,
                                renParam: true,
                            },
                            {
                                type: "bytes32",
                                name: "nHash",
                                value: EVMParam.EVM_NHASH,
                                notInPayload: true,
                                renParam: true,
                            },
                            {
                                type: "bytes",
                                name: "sig",
                                value: EVMParam.EVM_SIGNATURE,
                                notInPayload: true,
                                renParam: true,
                            },
                        ],
                    },
                };
            }
            return {
                chain: network.selector,
                type: "contract",
                params: {
                    to: EVMParam.EVM_GATEWAY,
                    method: "release",
                    params: [
                        {
                            type: "bytes32",
                            name: "pHash",
                            value: EVMParam.EVM_PHASH,
                            notInPayload: true,
                            renParam: true,
                        },
                        {
                            type: "uint256",
                            name: "amount",
                            value: EVMParam.EVM_AMOUNT,
                            notInPayload: true,
                            renParam: true,
                        },
                        {
                            type: "bytes32",
                            name: "nHash",
                            value: EVMParam.EVM_NHASH,
                            notInPayload: true,
                            renParam: true,
                        },
                        {
                            type: "bytes",
                            name: "calldata sig",
                            value: EVMParam.EVM_SIGNATURE,
                            notInPayload: true,
                            renParam: true,
                        },
                    ],
                },
            };
        default:
            throw new Error(`Unable to use .Account() for set-up call.`);
    }
};

export type EVMAddressPayload = EVMPayloadInterface<
    "address",
    {
        address: string;
        amount?: string;
        anyoneCanSubmit?: boolean;
        /**
         * @deprecated renamed to `convertUnit`.
         */
        convertToWei?: boolean;
        convertUnit?: boolean;
        infiniteApproval?: boolean;
    }
>;

export const accountPayloadHandler: PayloadHandler<EVMAddressPayload> = {
    getSetup: async ({
        network,
        signer,
        payload,
        evmParams,
        getPayloadHandler,
    }: {
        network: EVMNetworkConfig;
        signer?: Signer;
        payload: EVMAddressPayload;
        evmParams: EVMParamValues;
        getPayloadHandler: (payloadType: string) => PayloadHandler;
    }): Promise<{
        [name: string]: EVMPayload;
    }> => {
        if (!contractPayloadHandler.getSetup) {
            throw new Error(`Missing contract payload handler.`);
        }
        const contractPayload = await getContractFromAccount(
            network,
            payload,
            evmParams,
        );
        if (!contractPayload) {
            return {};
        }

        const amount = payload.params.infiniteApproval
            ? new BigNumber(2).pow(256).minus(1).toFixed()
            : utils.isDefined(payload.params.amount)
            ? new BigNumber(payload.params.amount)
                  .shiftedBy(
                      payload.params.convertUnit || payload.params.convertToWei
                          ? await evmParams[EVMParam.EVM_TOKEN_DECIMALS]()
                          : 0,
                  )
                  .toFixed()
            : undefined;

        if (!amount) {
            return {};
        }

        if (!evmParams[EVMParam.EVM_GATEWAY_IS_DEPOSIT_ASSET]) {
            const approval: EVMApprovalPayload = {
                chain: network.selector,
                type: "approval",
                params: {
                    token: EVMParam.EVM_TOKEN_ADDRESS,
                    spender: EVMParam.EVM_GATEWAY,
                    amount,
                },
            };

            if (
                approvalPayloadHandler.required &&
                (await approvalPayloadHandler.required({
                    network,
                    signer,
                    payload: approval,
                    evmParams,
                    getPayloadHandler,
                }))
            ) {
                return { approval };
            }
        }

        return {};
    },

    getPayload: async ({
        network,
        signer,
        payload,
        evmParams,
        getPayloadHandler,
    }: {
        network: EVMNetworkConfig;
        signer: Signer | undefined;
        payload: EVMAddressPayload;
        evmParams: EVMParamValues;
        getPayloadHandler: (payloadType: string) => PayloadHandler;
    }): Promise<{
        to: string;
        toBytes: Uint8Array;
        payload: Uint8Array;
    }> => {
        if (!contractPayloadHandler.getPayload) {
            throw new Error(`Missing contract payload handler.`);
        }
        const contractPayload = await getContractFromAccount(
            network,
            payload,
            evmParams,
        );
        if (!contractPayload) {
            const to = await replaceRenParam(payload.params.address, evmParams);
            return {
                to,
                toBytes: utils.fromHex(to),
                payload: new Uint8Array(),
            };
        }
        let p = await contractPayloadHandler.getPayload({
            network,
            signer,
            payload: contractPayload,
            evmParams,
            getPayloadHandler,
        });
        if (
            p.to.toLowerCase() ===
            (await evmParams[EVMParam.EVM_GATEWAY]()).toLowerCase()
        ) {
            const to = await replaceRenParam(payload.params.address, evmParams);
            if (!to) {
                throw new ErrorWithCode(
                    payload.params.address === EVMParam.EVM_ACCOUNT
                        ? ` Must connect ${network.selector} signer.`
                        : `Empty ${network.selector} recipient.`,
                    RenJSError.PARAMETER_ERROR,
                );
            }
            p = {
                ...p,
                to,
                toBytes: utils.fromHex(to),
            };
        }
        return p;
    },

    export: async ({
        network,
        signer,
        payload,
        evmParams,
        overrides,
        getPayloadHandler,
    }: {
        network: EVMNetworkConfig;
        signer?: Signer;
        payload: EVMAddressPayload;
        evmParams: EVMParamValues;
        overrides: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrides?: { [key: string]: any };
            txConfig?: PayableOverrides;
        };
        getPayloadHandler: (payloadType: string) => PayloadHandler;
    }): Promise<PopulatedTransaction> => {
        const contractPayload = await getContractFromAccount(
            network,
            payload,
            evmParams,
        );
        if (!contractPayload) {
            throw new Error(
                `Unable to submit empty payload for release to ${payload.params.address}.`,
            );
        }
        const exported = await contractPayloadHandler.export({
            network,
            signer,
            payload: contractPayload,
            evmParams,
            overrides,
            getPayloadHandler,
        });

        if (!payload.params.anyoneCanSubmit) {
            return {
                ...exported,
                from: ethers.utils.getAddress(
                    await replaceRenParam(payload.params.address, evmParams),
                ),
            };
        }

        return exported;
    },
};

export type EVMApprovalPayload = EVMPayloadInterface<
    "approval",
    {
        token: string;
        spender: string;
        amount: string;
        /**
         * @deprecated renamed to `convertUnit`.
         */
        convertToWei?: boolean;
        convertUnit?: boolean;
        txConfig?: PayableOverrides;
    }
>;

const resolveEVMApprovalParams = async (
    payload: EVMApprovalPayload,
    evmParams: EVMParamValues,
): Promise<EVMApprovalPayload> => {
    return {
        ...payload,
        params: {
            ...payload.params,
            token: await replaceRenParam(payload.params.token, evmParams),
            spender: await replaceRenParam(payload.params.spender, evmParams),
            amount: await replaceRenParam(payload.params.amount, evmParams),
        },
    };
};

const getContractFromApproval = async (
    network: EVMNetworkConfig,
    payload: EVMApprovalPayload,
    evmParams: EVMParamValues,
): Promise<EVMContractPayload> => {
    const amount = utils.isDefined(payload.params.amount)
        ? new BigNumber(payload.params.amount)
              .shiftedBy(
                  payload.params.convertUnit || payload.params.convertToWei
                      ? await evmParams[EVMParam.EVM_TOKEN_DECIMALS]()
                      : 0,
              )
              .toFixed()
        : undefined;

    return {
        chain: network.selector,
        type: "contract",
        params: {
            to: payload.params.token,
            method: "approve",
            params: [
                {
                    type: "address",
                    name: "to",
                    value: payload.params.spender,
                },
                {
                    type: "uint256",
                    name: "amount",
                    value: amount,
                },
            ],
        },
    };
};

export const approvalPayloadHandler: PayloadHandler<EVMApprovalPayload> = {
    getSetup: ({ payload }: { payload: EVMApprovalPayload }) =>
        payload.setup || {},

    required: async ({
        signer,
        payload,
        evmParams,
    }: {
        signer?: Signer;
        payload: EVMApprovalPayload;
        evmParams: EVMParamValues;
    }): Promise<boolean> => {
        payload = await resolveEVMApprovalParams(payload, evmParams);
        const token = payload.params.token;
        if (!signer) {
            return true;
        }
        const erc20Instance = getERC20Instance(signer, token);
        const account = await signer.getAddress();
        const allowance = new BigNumber(
            (
                await erc20Instance.allowance(account, payload.params.spender)
            ).toString(),
        );

        const amount = new BigNumber(payload.params.amount).shiftedBy(
            payload.params.convertUnit || payload.params.convertToWei
                ? await evmParams[EVMParam.EVM_TOKEN_DECIMALS]()
                : 0,
        );

        return allowance.lt(amount);
    },

    export: async ({
        network,
        signer,
        payload,
        evmParams,
        overrides,
        getPayloadHandler,
    }: {
        network: EVMNetworkConfig;
        signer?: Signer;
        payload: EVMApprovalPayload;
        evmParams: EVMParamValues;
        overrides: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrides?: { [key: string]: any };
            txConfig?: PayableOverrides;
        };
        getPayloadHandler: (payloadType: string) => PayloadHandler;
    }): Promise<PopulatedTransaction> => {
        payload = await resolveEVMApprovalParams(payload, evmParams);

        return contractPayloadHandler.export({
            network,
            signer,
            payload: await getContractFromApproval(network, payload, evmParams),
            evmParams,
            overrides,
            getPayloadHandler,
        });
    },
};

export type EVMTxPayload = EVMPayloadInterface<
    "transaction",
    {
        tx: ChainTransaction;
    }
>;

export const txPayloadHandler: PayloadHandler<EVMTxPayload> = {
    export: (): PopulatedTransaction => {
        throw new Error(`Unable to export transaction payload.`);
    },
};

export type EVMNoncePayload = EVMPayloadInterface<
    "nonce",
    {
        nonce: string | number;
    }
>;

export const noncePayloadHandler: PayloadHandler<EVMNoncePayload> = {
    export: (): PopulatedTransaction => {
        throw new Error(`Unable to export nonce payload.`);
    },
};

export type EVMPayload =
    | EVMContractPayload
    | EVMAddressPayload
    | EVMApprovalPayload
    | EVMTxPayload
    | EVMNoncePayload
    | { chain: string; type?: undefined };
