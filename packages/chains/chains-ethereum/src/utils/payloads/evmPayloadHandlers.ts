import BigNumber from "bignumber.js";
import { Contract, PayableOverrides, Signer } from "ethers";

import { TransactionResponse } from "@ethersproject/providers";
import {
    ErrorWithCode,
    InputType,
    OutputType,
    RenJSError,
    SyncOrPromise,
    utils,
} from "@renproject/utils";

import { getERC20Instance } from "../../contracts";
import { EthArg, payloadToABI } from "../abi";
import { fixEvmTransactionConfig } from "../evmTxSubmitter";
import { rawEncode } from "../generic";
import { EvmNetworkConfig } from "../types";

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
    [EVMParam.EVM_ACCOUNT]: () => Promise<string>;
    [EVMParam.EVM_ACCOUNT_IS_CONTRACT]: () => Promise<boolean>;
    [EVMParam.EVM_GATEWAY]: () => Promise<string>;
    [EVMParam.EVM_ASSET]: string;

    // Available when minting or releasing.
    [EVMParam.EVM_AMOUNT]?: string; // in wei
    [EVMParam.EVM_NHASH]?: Buffer;
    [EVMParam.EVM_PHASH]?: Buffer;
    [EVMParam.EVM_SIGNATURE]?: Buffer;
    [EVMParam.EVM_SIGNATURE_R]?: Buffer;
    [EVMParam.EVM_SIGNATURE_S]?: Buffer;
    [EVMParam.EVM_SIGNATURE_V]?: number;

    // Available when locking or burning.
    [EVMParam.EVM_TO_CHAIN]?: string;
    [EVMParam.EVM_TO_ADDRESS]?: string;
    [EVMParam.EVM_TO_ADDRESS_BYTES]?: Buffer;
    [EVMParam.EVM_TO_PAYLOAD]?: Buffer;
    // Available when locking deposit assets (e.g. ETH on Ethereum, FTM on Fantom)
    [EVMParam.EVM_GATEWAY_IS_DEPOSIT_ASSET]?: boolean;
    [EVMParam.EVM_GATEWAY_DEPOSIT_ADDRESS]?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isEVMParam = (value: any): value is EVMParam =>
    Object.values(EVMParam).indexOf(value) >= 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface EVMPayloadInterface<Name extends string = string, T = any> {
    chain: string;
    txConfig?: PayableOverrides;
    type: Name;
    params: T;
    setup?: {
        [name: string]: EVMPayload;
    };
}

export interface PayloadHandler<P extends EVMPayload = EVMPayload> {
    required?: (
        network: EvmNetworkConfig,
        signer: Signer,
        payload: P,
        evmParams: EVMParamValues,
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ) => SyncOrPromise<boolean>;
    getSetup?: (
        network: EvmNetworkConfig,
        signer: Signer,
        payload: P,
        evmParams: EVMParamValues,
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ) => SyncOrPromise<{
        [name: string]: EVMPayload;
    }>;
    getPayload?: (
        network: EvmNetworkConfig,
        signer: Signer | undefined,
        payload: P,
        evmParams: EVMParamValues,
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ) => SyncOrPromise<{
        to: string;
        toBytes: Buffer;
        payload: Buffer;
    }>;
    submit: (
        network: EvmNetworkConfig,
        signer: Signer,
        payload: P,
        evmParams: EVMParamValues,
        overrides: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            params?: { [key: string]: any };
            txConfig?: PayableOverrides;
        },
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ) => SyncOrPromise<TransactionResponse>;
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
const resolveEvmContractParams = async (
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
    getSetup: (
        _network: EvmNetworkConfig,
        _signer: Signer,
        payload: EVMContractPayload,
        _evmParams: EVMParamValues,
        _getPayloadHandler: (payloadType: string) => PayloadHandler,
    ) => payload.setup || {},

    getPayload: async (
        network: EvmNetworkConfig,
        _signer: Signer | undefined,
        payload: EVMContractPayload,
        evmParams: EVMParamValues,
    ): Promise<{
        to: string;
        toBytes: Buffer;
        payload: Buffer;
    }> => {
        try {
            payload = await resolveEvmContractParams(payload, evmParams);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            throw ErrorWithCode.from(
                new Error(
                    `Error getting contract-call payload: ${String(
                        error.message,
                    )}`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        const args = payload.params.params.filter((arg) => !arg.notInPayload);

        for (const arg of args) {
            if (arg.value === undefined) {
                throw ErrorWithCode.from(
                    new Error(`Payload parameter '${arg.name}' is undefined.`),
                    RenJSError.PARAMETER_ERROR,
                );
            }
        }

        const types = args.map((param) => param.type);
        const values = args.map((param): unknown => param.value);

        let p: Buffer;
        try {
            p = rawEncode(types, values);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            throw ErrorWithCode.from(
                new Error(
                    `Error encoding ${network.selector} parameters: ${String(
                        error.message,
                    )}`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        return {
            to: payload.params.to,
            toBytes: utils.fromHex(payload.params.to),
            payload: p,
        };
    },

    submit: async (
        network: EvmNetworkConfig,
        signer: Signer,
        payload: EVMContractPayload,
        evmParams: EVMParamValues,
        overrides: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            params?: { [key: string]: any };
            txConfig?: PayableOverrides;
        },
    ): Promise<TransactionResponse> => {
        try {
            payload = await resolveEvmContractParams(payload, evmParams);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            throw ErrorWithCode.from(
                new Error(
                    `Error resolving parameters for contract-call: ${String(
                        error.message,
                    )}`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        // Get parameter values, checking first if each value has been
        // overridden.
        const params = payload.params.params.map((x) =>
            overrides.params && utils.isDefined(overrides.params[x.name])
                ? {
                      ...x,
                      value: overrides.params[x.name],
                  }
                : x,
        );
        const paramTypes = params.map((x) => x.type);
        const paramValues = params.map((x) => x.value);

        for (const param of params) {
            if (param.value === undefined) {
                throw ErrorWithCode.from(
                    new Error(`Parameter '${param.name}' is undefined.`),
                    RenJSError.PARAMETER_ERROR,
                );
            }
        }

        try {
            rawEncode(paramTypes, paramValues);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            throw ErrorWithCode.from(
                new Error(
                    `Error encoding ${network.selector} parameters: ${String(
                        error.message,
                    )}`,
                ),
                RenJSError.PARAMETER_ERROR,
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
        return await contract[abi.name](
            ...paramValues,
            fixEvmTransactionConfig(
                payload.params.txConfig,
                overrides.txConfig,
            ),
        );
    },
};

const getContractFromAccount = async (
    network: EvmNetworkConfig,
    payload: EVMAddressPayload,
    evmParams: EVMParamValues,
): Promise<EVMContractPayload | undefined> => {
    const amount = utils.isDefined(payload.params.amount)
        ? new BigNumber(payload.params.amount)
              .shiftedBy(
                  payload.params.convertToWei
                      ? await evmParams[EVMParam.EVM_TOKEN_DECIMALS]()
                      : 0,
              )
              .toFixed()
        : undefined;
    switch (evmParams[EVMParam.EVM_TRANSACTION_TYPE]) {
        case InputType.Lock:
            if (!amount) {
                throw ErrorWithCode.from(
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
                setup: {
                    approval: {
                        chain: network.selector,
                        type: "approval",
                        params: {
                            token: EVMParam.EVM_TOKEN_ADDRESS,
                            spender: EVMParam.EVM_GATEWAY,
                            amount: amount,
                        },
                    } as EVMApprovalPayload,
                },
            };
        case InputType.Burn:
            if (!amount) {
                throw ErrorWithCode.from(
                    new Error(`Must provide amount to .Account()`),
                    RenJSError.PARAMETER_ERROR,
                );
            }

            if (evmParams[EVMParam.EVM_OUTPUT_TYPE] === "mint") {
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
                                value: Buffer.from([]),
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
            // if (
            //     payload.params.address.toLowerCase() !==
            //         (await evmParams[EVMParam.EVM_ACCOUNT]()).toLowerCase() ||
            //     evmParams[EVMParam.EVM_ACCOUNT_IS_CONTRACT]
            // ) {
            //     return {
            //         chain: network.selector,
            //         type: "contract",
            //         params: {
            //             to: EVMParam.EVM_GATEWAY,
            //             method: "mint",
            //             params: [
            //                 {
            //                     type: "bytes32",
            //                     name: "pHash",
            //                     value: EVMParam.EVM_PHASH,
            //                     notInPayload: true,
            //                 },
            //                 {
            //                     type: "uint256",
            //                     name: "amount",
            //                     value: EVMParam.EVM_AMOUNT,
            //                     notInPayload: true,
            //                 },
            //                 {
            //                     type: "bytes32",
            //                     name: "nHash",
            //                     value: EVMParam.EVM_NHASH,
            //                     notInPayload: true,
            //                 },
            //                 {
            //                     type: "bytes",
            //                     name: "calldata sig",
            //                     value: EVMParam.EVM_SIGNATURE,
            //                     notInPayload: true,
            //                 },
            //             ],
            //         },
            //     };
            // }
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
                        },
                        {
                            type: "uint256",
                            name: "amount",
                            value: EVMParam.EVM_AMOUNT,
                            notInPayload: true,
                        },
                        {
                            type: "bytes32",
                            name: "nHash",
                            value: EVMParam.EVM_NHASH,
                            notInPayload: true,
                        },
                        {
                            type: "bytes",
                            name: "sig",
                            value: EVMParam.EVM_SIGNATURE,
                            notInPayload: true,
                        },
                    ],
                },
            };
        case OutputType.Release:
            if (evmParams[EVMParam.EVM_GATEWAY_IS_DEPOSIT_ASSET]) {
                return undefined;
            }
            // if (
            //     payload.params.address.toLowerCase() !==
            //         (await evmParams[EVMParam.EVM_ACCOUNT]()).toLowerCase() ||
            //     evmParams[EVMParam.EVM_ACCOUNT_IS_CONTRACT]
            // ) {
            //     return {
            //         chain: network.selector,
            //         type: "contract",
            //         params: {
            //             to: network.addresses.BasicBridge,
            //             method: "release",
            //             params: [
            //                 {
            //                     type: "string",
            //                     name: "symbol",
            //                     value: EVMParam.EVM_ASSET,
            //                 },
            //                 {
            //                     type: "address",
            //                     name: "recipient",
            //                     value: payload.params.address,
            //                 },
            //                 {
            //                     type: "uint256",
            //                     name: "amount",
            //                     value: EVMParam.EVM_AMOUNT,
            //                     notInPayload: true,
            //                 },
            //                 {
            //                     type: "bytes32",
            //                     name: "nHash",
            //                     value: EVMParam.EVM_NHASH,
            //                     notInPayload: true,
            //                 },
            //                 {
            //                     type: "bytes",
            //                     name: "sig",
            //                     value: EVMParam.EVM_SIGNATURE,
            //                     notInPayload: true,
            //                 },
            //             ],
            //         },
            //     };
            // }
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
                        },
                        {
                            type: "uint256",
                            name: "amount",
                            value: EVMParam.EVM_AMOUNT,
                            notInPayload: true,
                        },
                        {
                            type: "bytes32",
                            name: "nHash",
                            value: EVMParam.EVM_NHASH,
                            notInPayload: true,
                        },
                        {
                            type: "bytes",
                            name: "calldata sig",
                            value: EVMParam.EVM_SIGNATURE,
                            notInPayload: true,
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
        convertToWei?: boolean;
    }
>;

export const accountPayloadHandler: PayloadHandler<EVMAddressPayload> = {
    getSetup: async (
        network: EvmNetworkConfig,
        signer: Signer,
        payload: EVMAddressPayload,
        evmParams: EVMParamValues,
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ) => {
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
        return await contractPayloadHandler.getSetup(
            network,
            signer,
            contractPayload,
            evmParams,
            getPayloadHandler,
        );
    },

    getPayload: async (
        network: EvmNetworkConfig,
        signer: Signer | undefined,
        payload: EVMAddressPayload,
        evmParams: EVMParamValues,
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ): Promise<{
        to: string;
        toBytes: Buffer;
        payload: Buffer;
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
                payload: Buffer.from([]),
            };
        }
        let p = await contractPayloadHandler.getPayload(
            network,
            signer,
            contractPayload,
            evmParams,
            getPayloadHandler,
        );
        if (
            p.to.toLowerCase() ===
            (await evmParams[EVMParam.EVM_GATEWAY]()).toLowerCase()
        ) {
            const to = await replaceRenParam(payload.params.address, evmParams);
            p = {
                ...p,
                to,
                toBytes: utils.fromHex(to),
            };
        }
        return p;
    },

    submit: async (
        network: EvmNetworkConfig,
        signer: Signer,
        payload: EVMAddressPayload,
        evmParams: EVMParamValues,
        overrides: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            params?: { [key: string]: any };
            txConfig?: PayableOverrides;
        },
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ): Promise<TransactionResponse> => {
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
        return contractPayloadHandler.submit(
            network,
            signer,
            contractPayload,
            evmParams,
            overrides,
            getPayloadHandler,
        );
    },
};

export type EVMApprovalPayload = EVMPayloadInterface<
    "approval",
    {
        token: string;
        spender: string;
        amount: string;
        convertToWei?: boolean;
        txConfig?: PayableOverrides;
    }
>;

const resolveEvmApprovalParams = async (
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
    network: EvmNetworkConfig,
    payload: EVMApprovalPayload,
    evmParams: EVMParamValues,
): Promise<EVMContractPayload> => {
    const amount = utils.isDefined(payload.params.amount)
        ? new BigNumber(payload.params.amount)
              .shiftedBy(
                  payload.params.convertToWei
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
    getSetup: (
        _network: EvmNetworkConfig,
        _signer: Signer,
        payload: EVMApprovalPayload,
        _evmParams: EVMParamValues,
        _getPayloadHandler: (payloadType: string) => PayloadHandler,
    ) => payload.setup || {},

    required: async (
        _network: EvmNetworkConfig,
        signer: Signer,
        payload: EVMApprovalPayload,
        evmParams: EVMParamValues,
    ): Promise<boolean> => {
        payload = await resolveEvmApprovalParams(payload, evmParams);
        const token = payload.params.token;
        const erc20Instance = getERC20Instance(signer, token);
        const account = await signer.getAddress();
        const allowance = new BigNumber(
            (
                await erc20Instance.allowance(account, payload.params.spender)
            ).toString(),
        );
        return allowance.lt(new BigNumber(payload.params.amount));
    },

    submit: async (
        network: EvmNetworkConfig,
        signer: Signer,
        payload: EVMApprovalPayload,
        evmParams: EVMParamValues,
        overrides: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            params?: { [key: string]: any };
            txConfig?: PayableOverrides;
        },
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ): Promise<TransactionResponse> => {
        payload = await resolveEvmApprovalParams(payload, evmParams);

        return contractPayloadHandler.submit(
            network,
            signer,
            await getContractFromApproval(network, payload, evmParams),
            evmParams,
            overrides,
            getPayloadHandler,
        );
    },
};

export type EVMPayload =
    | EVMContractPayload
    | EVMAddressPayload
    | EVMApprovalPayload;
