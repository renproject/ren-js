import { ethers, PayableOverrides } from "ethers";

import { Provider } from "@ethersproject/providers";
import {
    ExternalProvider,
    JsonRpcFetchFunc,
} from "@ethersproject/providers/lib/web3-provider";
import {
    InputType,
    Logger,
    OutputType,
    RenNetwork,
    RenNetworkString,
    SyncOrPromise,
} from "@renproject/utils";

import { EthArg } from "./abi";

export interface EthereumTransactionConfig extends PayableOverrides {}

export interface EvmNetworkConfig {
    selector: string;
    isTestnet?: boolean;
    logRequestLimit?: number;
    asset: string;

    addresses: {
        GatewayRegistry: string;
        BasicAdapter: string;
    };

    // See https://eips.ethereum.org/EIPS/eip-3085
    network: {
        // The integer ID of the chain as a hexadecimal string.
        chainId: string;

        // One or more URLs pointing to block explorer web sites for the chain.
        blockExplorerUrls: string[];

        // A human-readable name for the chain.
        chainName: string;

        // One or more URLs pointing to reasonably sized images that can be used
        // to visually identify the chain.
        iconUrls?: string[];

        // The native currency of the chain.
        nativeCurrency: {
            name: string;
            symbol: string;
            decimals: number;
        };

        // One or more URLs pointing to RPC endpoints that can be used to
        // communicate with the chain.
        // Each chain may define variables that will be replaced using the
        // notation `${VARIABLE_NAME}`, such as `${INFURA_API_KEY}`.
        rpcUrls: string[];
    };
}

export type EvmNetworkInput = RenNetwork | RenNetworkString | EvmNetworkConfig;

export const isEvmNetworkConfig = (
    renNetwork: EvmNetworkInput,
): renNetwork is EvmNetworkConfig =>
    !!(renNetwork as EvmNetworkConfig).addresses;

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
          signer?: ethers.Signer;
      };

export type EthProviderUpdate =
    | EthProvider
    | {
          signer: ethers.Signer;
      };

export interface EthereumClassConfig {
    logger?: Logger;
}

export interface ContractCall {
    chain: string;
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
    ) => SyncOrPromise<{ [key: string]: ContractCall }>;
    getContractCall: (
        asset: string,
        type: InputType,
        toChain: string,
        toPayload: {
            to: string;
            payload: Buffer;
            gatewayAddress?: string;
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
    ) => SyncOrPromise<{ [key: string]: ContractCall }>;
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
