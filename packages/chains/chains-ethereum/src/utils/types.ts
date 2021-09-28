import { ethers, PayableOverrides } from "ethers";

import { Provider } from "@ethersproject/providers";
import {
    ExternalProvider,
    JsonRpcFetchFunc,
} from "@ethersproject/providers/lib/web3-provider";
import {
    InputType,
    OutputType,
    RenNetwork,
    RenNetworkString,
    SyncOrPromise,
} from "@renproject/interfaces";

import { EthArg } from "./abi";

export interface EthereumTransactionConfig extends PayableOverrides {}

export interface EvmNetworkConfig {
    name: string;

    isTestnet?: boolean;
    networkID: number;

    /**
     * A method for getting a public provider as a URI. Accepts an optional
     * map of provider API keys, as documented by each network.
     *
     * Note that this isn't used by RenJS internally.
     */
    rpcUrl: (keys?: {
        infura?: string;
        [key: string]: string | undefined;
    }) => string;

    explorer: {
        url: string;
        address: (address: string) => string;
        transaction: (transaction: string) => string;
    };

    addresses: {
        GatewayRegistry: string;
        BasicAdapter: string;
    };
}

export type EvmNetworkInput = RenNetwork | RenNetworkString | EvmNetworkConfig;

export const isEvmConfig = (
    renNetwork: EvmNetworkInput,
): renNetwork is EvmNetworkConfig => {
    return !!(renNetwork as EvmNetworkConfig).addresses;
};

export type EvmNetworkConfigMap = {
    [network in RenNetwork]?: EvmNetworkConfig;
};

export type EthProviderCompat =
    | string
    | {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sendAsync?: (request: any, callback: any) => any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          send?: (request: any, callback: any) => any;
      };

/* eslint-enable @typescript-eslint/no-explicit-any */

export type EthProvider =
    | EthProviderCompat
    | ExternalProvider
    | JsonRpcFetchFunc
    | {
          provider: Provider;
          signer: ethers.Signer;
      };

export interface ContractCall {
    chain: string;
    precheck?: (asset: string, type: InputType | OutputType) => boolean;
    getContractCall: (
        asset: string,
        type: InputType | OutputType,
    ) => SyncOrPromise<{
        to: string;
        method: string;
        values: EthArg[];
        txConfig?: unknown;
    }>;
}

export type InputContractCall = {
    chain: string;
    getSetupContractCalls?: (
        asset: string,
        type: InputType,
    ) => { [key: string]: ContractCall };
    getContractCall: (
        asset: string,
        type: InputType,
        toChain: string,
        toPayload: {
            to: string;
            payload: Buffer;
        },
    ) => SyncOrPromise<{
        to: string;
        method: string;
        values: EthArg[];
        txConfig?: unknown;
    }>;
};

export type OutputContractCall = {
    chain: string;
    getSetupContractCalls?: (
        asset: string,
        type: OutputType,
    ) => { [key: string]: ContractCall };
    getPayload: (
        asset: string,
        type: OutputType,
    ) => SyncOrPromise<{
        to: string;
        values: EthArg[];
    }>;
    getContractCall: (
        asset: string,
        type: OutputType,
        pHash: Buffer,
        amount: string,
        nHash: Buffer,
        signature: Buffer,
    ) => SyncOrPromise<{
        to: string;
        method: string;
        values: EthArg[];
        txConfig?: unknown;
    }>;
};
