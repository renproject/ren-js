import { SyncOrPromise } from "@renproject/utils";
import { PayableOverrides, PopulatedTransaction, Signer } from "ethers";

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
        [name: string]: EVMPayloadInterface;
    };

    payloadConfig?: {
        detectPreviousDeposits?: boolean;

        /**
         * Whether the `to` field passed to the RenVM transaction should remain
         * preserved, for resuming a transaction that was created with a
         * non-standard address format (no 0x prefix, or no checksum). This is
         * used by the RenVM Explorer.
         */
        preserveAddressFormat?: boolean;
    };
}

export interface PayloadHandler<
    P extends EVMPayloadInterface = EVMPayloadInterface,
> {
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
        [name: string]: EVMPayloadInterface;
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

export const replaceRenParam = async (
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
