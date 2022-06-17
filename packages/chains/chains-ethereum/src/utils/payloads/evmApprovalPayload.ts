import { utils } from "@renproject/utils";
import BigNumber from "bignumber.js";
import { PayableOverrides, PopulatedTransaction, Signer } from "ethers";

import { getERC20Instance } from "../../contracts";
import { EVMNetworkConfig } from "../types";
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

export type EVMApprovalPayload = EVMPayloadInterface<
    "approval",
    {
        token: string;
        spender: string;
        amount: string;
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
                  payload.params.convertUnit
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
            payload.params.convertUnit
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
