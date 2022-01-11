import { ethers } from "ethers";

import { Provider } from "@ethersproject/providers";
import {
    ExternalProvider,
    JsonRpcFetchFunc,
} from "@ethersproject/providers/lib/web3-provider";
import { Logger, RenNetwork, RenNetworkString } from "@renproject/utils";

export interface EvmNetworkConfig {
    selector: string;
    isTestnet?: boolean;
    logRequestLimit?: number;

    addresses: {
        GatewayRegistry: string;
        BasicBridge: string;
    };

    // See EvmNetworkConfig.network.nativeCurrency
    nativeAsset: {
        name: string;
        symbol: string;
        decimals: number;
    };
    averageConfirmationTime: number;

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

export type EthProvider =
    | string
    | {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sendAsync?: (request: any, callback: any) => any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          send?: (request: any, callback: any) => any;
      }
    | ExternalProvider
    | JsonRpcFetchFunc
    | Provider;

export type EthSigner = ethers.Signer;

export interface EthereumClassConfig {
    logger?: Logger;
}
