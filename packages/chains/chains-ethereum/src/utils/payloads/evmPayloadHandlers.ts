import BigNumber from "bignumber.js";
import { Contract, PayableOverrides, Signer } from "ethers";

import { TransactionResponse } from "@ethersproject/providers";
import {
    fromHex,
    InputType,
    isDefined,
    OutputType,
    Ox,
    RenJSError,
    SyncOrPromise,
    withCode,
} from "@renproject/utils";

import { getERC20Instance } from "../../contracts";
import { EthArg, payloadToABI } from "../abi";
import { fixEvmTransactionConfig } from "../evmTxSubmitter";
import { rawEncode } from "../generic";
import { EvmNetworkConfig } from "../types";

export enum EVMParam {
    // Always available
    EVM_TRANSACTION_TYPE = "__EVM_TRANSACTION_TYPE__",
    EVM_TOKEN_ADDRESS = "__EVM_TOKEN_ADDRESS__",
    EVM_GATEWAY_DEPOSIT_ADDRESS = "__EVM_GATEWAY_DEPOSIT_ADDRESS__",
    EVM_ACCOUNT = "__EVM_ACCOUNT__",
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
    [EVMParam.EVM_TRANSACTION_TYPE]:
        | "setup"
        | "lock"
        | "mint"
        | "release"
        | "burn";
    [EVMParam.EVM_TOKEN_ADDRESS]: () => Promise<string>;
    [EVMParam.EVM_ACCOUNT]: () => Promise<string>;
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
    // Available when locking the fee asset.
    [EVMParam.EVM_GATEWAY_DEPOSIT_ADDRESS]?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isEVMParam = (value: any): value is EVMParam =>
    Object.values(EVMParam).indexOf(value) >= 0;

export interface EVMPayload<Name extends string = string, T = any> {
    chain: string;
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
            params?: { [key: string]: any };
            txConfig?: PayableOverrides;
        },
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ) => SyncOrPromise<TransactionResponse>;
}

const replaceRenParam = async (
    value: any,
    evmParams: EVMParamValues,
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
            values: await Promise.all(
                payload.params.values.map(async (value) => ({
                    ...value,
                    value: await replaceRenParam(value.value, evmParams),
                })),
            ),
        },
    };
};

export type EVMContractPayload = EVMPayload<
    "contract",
    {
        to: string;
        method: string;
        values: Array<EthArg>;
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
        } catch (error: any) {
            throw withCode(
                new Error(
                    `Error getting contract-call payload: ${String(
                        error.message,
                    )}`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        const args = payload.params.values.filter((arg) => !arg.notInPayload);

        for (const arg of args) {
            if (arg.value === undefined) {
                throw withCode(
                    new Error(`Parameter '${arg.name}' is undefined.`),
                    RenJSError.PARAMETER_ERROR,
                );
            }
        }

        const types = args.map((param) => param.type);
        const values = args.map((param): unknown => param.value);

        let p: Buffer;
        try {
            p = rawEncode(types, values);
        } catch (error: any) {
            throw withCode(
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
            toBytes: fromHex(payload.params.to),
            payload: p,
        };
    },

    submit: async (
        network: EvmNetworkConfig,
        signer: Signer,
        payload: EVMContractPayload,
        evmParams: EVMParamValues,
        overrides: {
            params?: { [key: string]: any };
            txConfig?: PayableOverrides;
        },
    ): Promise<TransactionResponse> => {
        try {
            payload = await resolveEvmContractParams(payload, evmParams);
        } catch (error: any) {
            throw withCode(
                new Error(
                    `Error resolving parameters for contract-call : ${String(
                        error.message,
                    )}`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        // Get parameter values, checking first if each value has been
        // overridden.
        const params = payload.params.values.map((x) =>
            overrides.params && isDefined(overrides.params[x.name])
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
                throw withCode(
                    new Error(`Parameter '${param.name}' is undefined.`),
                    RenJSError.PARAMETER_ERROR,
                );
            }
        }

        try {
            rawEncode(paramTypes, paramValues);
        } catch (error: any) {
            throw withCode(
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

const getContractFromAccount = (
    network: EvmNetworkConfig,
    payload: EVMAccountPayload,
    evmParams: EVMParamValues,
): EVMContractPayload => {
    switch (evmParams[EVMParam.EVM_TRANSACTION_TYPE]) {
        case InputType.Lock:
            if (!payload.params.amount) {
                throw withCode(
                    new Error(`Must provide amount to .Account()`),
                    RenJSError.PARAMETER_ERROR,
                );
            }
            if (evmParams[EVMParam.EVM_GATEWAY_DEPOSIT_ADDRESS]) {
                return {
                    chain: network.selector,
                    type: "contract",
                    params: {
                        to: network.addresses.BasicAdapter,
                        method: "transferWithLog",
                        values: [
                            {
                                type: "address",
                                name: "to",
                                value: EVMParam.EVM_GATEWAY_DEPOSIT_ADDRESS,
                            },
                        ],
                        txConfig: {
                            value: new BigNumber(
                                payload.params.amount,
                            ).toFixed(),
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
                    values: [
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
                            value: new BigNumber(
                                payload.params.amount,
                            ).toFixed(),
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
                            amount: new BigNumber(
                                payload.params.amount,
                            ).toFixed(),
                        },
                    } as EVMApprovalPayload,
                },
            };
        case InputType.Burn:
            if (!payload.params.amount) {
                throw withCode(
                    new Error(`Must provide amount to .Account()`),
                    RenJSError.PARAMETER_ERROR,
                );
            }

            return {
                chain: network.selector,
                type: "contract",
                params: {
                    to: EVMParam.EVM_GATEWAY,
                    method: "burn",
                    values: [
                        {
                            type: "bytes" as const,
                            name: "_to",
                            value: EVMParam.EVM_TO_ADDRESS_BYTES,
                        },
                        {
                            type: "uint256" as const,
                            name: "_amount",
                            value: new BigNumber(
                                payload.params.amount,
                            ).toFixed(),
                        },
                    ],
                },
            };
        case OutputType.Mint:
            return {
                chain: network.selector,
                type: "contract",
                params: {
                    to: network.addresses.BasicAdapter,
                    method: "mint",
                    values: [
                        {
                            type: "string",
                            name: "symbol",
                            value: EVMParam.EVM_ASSET,
                        },
                        {
                            type: "address",
                            name: "recipient",
                            value: EVMParam.EVM_ACCOUNT,
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
            return {
                chain: network.selector,
                type: "contract",
                params: {
                    to: EVMParam.EVM_GATEWAY,
                    // to: network.addresses.BasicAdapter,
                    method: "release",
                    values: [
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

                        // {
                        //     type: "string",
                        //     name: "symbol_",
                        //     value: EVMParam.EVM_ASSET,
                        // },
                        // {
                        //     type: "string",
                        //     name: "recipient",
                        //     value: EVMParam.EVM_ACCOUNT,
                        // },
                        // {
                        //     type: "uint256",
                        //     name: "amount",
                        //     value: EVMParam.EVM_AMOUNT,
                        //     notInPayload: true,
                        // },
                        // {
                        //     type: "bytes32",
                        //     name: "nHash",
                        //     value: EVMParam.EVM_NHASH,
                        //     notInPayload: true,
                        // },
                        // {
                        //     type: "bytes",
                        //     name: "sig",
                        //     value: EVMParam.EVM_SIGNATURE,
                        //     notInPayload: true,
                        // },
                    ],
                },
            };
        default:
            throw new Error(`Unable to use .Account() for set-up call.`);
    }
};

export type EVMAccountPayload = EVMPayload<
    "account",
    {
        amount?: BigNumber | string | number;
    }
>;

export const accountPayloadHandler: PayloadHandler<EVMAccountPayload> = {
    getSetup: async (
        network: EvmNetworkConfig,
        signer: Signer,
        payload: EVMAccountPayload,
        evmParams: EVMParamValues,
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ) => {
        if (!contractPayloadHandler.getSetup) {
            throw new Error(`Missing contract payload handler.`);
        }
        return await contractPayloadHandler.getSetup(
            network,
            signer,
            getContractFromAccount(network, payload, evmParams),
            evmParams,
            getPayloadHandler,
        );
    },

    getPayload: async (
        network: EvmNetworkConfig,
        signer: Signer | undefined,
        payload: EVMAccountPayload,
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
        if (evmParams[EVMParam.EVM_TRANSACTION_TYPE] === OutputType.Release) {
            const to = await evmParams[EVMParam.EVM_ACCOUNT]();
            return {
                to: to,
                toBytes: fromHex(to),
                payload: Buffer.from([]),
            };
        }
        return await contractPayloadHandler.getPayload(
            network,
            signer,
            getContractFromAccount(network, payload, evmParams),
            evmParams,
            getPayloadHandler,
        );
    },

    submit: async (
        network: EvmNetworkConfig,
        signer: Signer,
        payload: EVMAccountPayload,
        evmParams: EVMParamValues,
        overrides: {
            params?: { [key: string]: any };
            txConfig?: PayableOverrides;
        },
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ): Promise<TransactionResponse> => {
        return contractPayloadHandler.submit(
            network,
            signer,
            getContractFromAccount(network, payload, evmParams),
            evmParams,
            overrides,
            getPayloadHandler,
        );
    },
};

export type EVMApprovalPayload = EVMPayload<
    "approval",
    {
        token: string;
        spender: string;
        amount: string;
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

const getContractFromApproval = (
    network: EvmNetworkConfig,
    payload: EVMApprovalPayload,
): EVMContractPayload => {
    return {
        chain: network.selector,
        type: "contract",
        params: {
            to: payload.params.token,
            method: "approve",
            values: [
                {
                    type: "address",
                    name: "to",
                    value: payload.params.spender,
                },
                {
                    type: "uint256",
                    name: "amount",
                    value: payload.params.amount,
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
            params?: { [key: string]: any };
            txConfig?: PayableOverrides;
        },
        getPayloadHandler: (payloadType: string) => PayloadHandler,
    ): Promise<TransactionResponse> => {
        payload = await resolveEvmApprovalParams(payload, evmParams);

        return contractPayloadHandler.submit(
            network,
            signer,
            getContractFromApproval(network, payload),
            evmParams,
            overrides,
            getPayloadHandler,
        );
    },
};
