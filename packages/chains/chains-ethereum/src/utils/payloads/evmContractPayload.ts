import { JsonFragmentType } from "@ethersproject/abi";
import { ErrorWithCode, RenJSError, utils } from "@renproject/utils";
import {
    Contract,
    PayableOverrides,
    PopulatedTransaction,
    Signer,
} from "ethers";

import { EthArg, payloadToABI } from "../abi";
import { fixEVMTransactionConfig } from "../evmTxSubmitter";
import { rawEncode } from "../generic";
import { EVMNetworkConfig } from "../types";
import {
    EVMParamValues,
    EVMPayloadInterface,
    PayloadHandler,
    replaceRenParam,
} from "./evmParams";

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

        const types: JsonFragmentType[] = args.map(
            ({ value: _, ...params }) => params as JsonFragmentType,
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
        const paramTypes: JsonFragmentType[] = params.map(
            ({ value: _value, ...paramABI }) => paramABI as JsonFragmentType,
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
