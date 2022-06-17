import {
    ErrorWithCode,
    InputType,
    OutputType,
    RenJSError,
    utils,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { ethers, PayableOverrides, PopulatedTransaction, Signer } from "ethers";

import { EVMNetworkConfig } from "../types";
import {
    approvalPayloadHandler,
    EVMApprovalPayload,
} from "./evmApprovalPayload";
import {
    contractPayloadHandler,
    EVMContractPayload,
} from "./evmContractPayload";
import {
    EVMParam,
    EVMParamValues,
    EVMPayloadInterface,
    PayloadHandler,
    replaceRenParam,
} from "./evmParams";

export type EVMAddressPayload = EVMPayloadInterface<
    "address",
    {
        address: string;
        amount?: string;
        anyoneCanSubmit?: boolean;
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
        [name: string]: EVMPayloadInterface;
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
                      payload.params.convertUnit
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

const gatewayMintParams = [
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
];

const basicBridgeParams = (address: string) => [
    {
        type: "string",
        name: "symbol",
        value: EVMParam.EVM_ASSET,
    },
    {
        type: "address",
        name: "recipient",
        value: address,
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
];

const gatewayBurnToParams = (
    toPayload: Uint8Array | string,
    amount: string,
) => [
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
];

const gatewayBurnParams = (amount: string) => [
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
];

const transferWithLogParams = [
    {
        type: "address",
        name: "to",
        value: EVMParam.EVM_GATEWAY_DEPOSIT_ADDRESS,
    },
];

/**
 * Generate an EVM Contract payload from the account payload details.
 */
const getContractFromAccount = async (
    network: EVMNetworkConfig,
    payload: EVMAddressPayload,
    evmParams: EVMParamValues,
): Promise<EVMContractPayload | undefined> => {
    const amount = utils.isDefined(payload.params.amount)
        ? new BigNumber(payload.params.amount)
              .shiftedBy(
                  payload.params.convertUnit
                      ? await evmParams[EVMParam.EVM_TOKEN_DECIMALS]()
                      : 0,
              )
              .toFixed()
        : undefined;
    switch (evmParams[EVMParam.EVM_TRANSACTION_TYPE]) {
        case InputType.Lock:
            if (!amount) {
                throw ErrorWithCode.updateError(
                    new Error(`Must provide amount to account payload`),
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
                        params: transferWithLogParams,
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
                    params: gatewayBurnToParams(
                        EVMParam.EVM_TO_PAYLOAD,
                        amount,
                    ),
                },
            };
        case InputType.Burn:
            if (!amount) {
                throw ErrorWithCode.updateError(
                    new Error(`Must provide amount to account payload`),
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
                        params: gatewayBurnToParams(toPayload, amount),
                    },
                };
            } else {
                return {
                    chain: network.selector,
                    type: "contract",
                    params: {
                        to: EVMParam.EVM_GATEWAY,
                        method: "burn",
                        params: gatewayBurnParams(amount),
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
                        params: basicBridgeParams(payload.params.address),
                    },
                };
            }
            return {
                chain: network.selector,
                type: "contract",
                params: {
                    to: EVMParam.EVM_GATEWAY,
                    method: "mint",
                    params: gatewayMintParams,
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
                        params: basicBridgeParams(payload.params.address),
                    },
                };
            }
            return {
                chain: network.selector,
                type: "contract",
                params: {
                    to: EVMParam.EVM_GATEWAY,
                    method: "release",
                    params: gatewayMintParams,
                },
            };
        default:
            throw new Error(`Unable to use account payload for set-up call.`);
    }
};
