import { Provider } from "@ethersproject/providers";
import {
    ExternalProvider,
    JsonRpcFetchFunc,
} from "@ethersproject/providers/lib/web3-provider";
import { Logger, RenNetwork } from "@renproject/utils";
import { ethers } from "ethers";

export interface EVMExplorer {
    url: string;
    address: (address: string) => string;
    transaction: (txid: string) => string;
}

/**
 * Returns an EVMExplorer with the format `${url}/address/${address}` and
 * `${url}/tx/${txHash}` for addresses and transactions respectively.
 */
export const StandardEVMExplorer = (baseUrl: string): EVMExplorer => ({
    url: baseUrl,

    address: (address: string) =>
        `${baseUrl.replace(/\/$/, "")}/address/${address}`,

    transaction: (txHash: string) =>
        `${baseUrl.replace(/\/$/, "")}/tx/${txHash || ""}`,
});

// See https://eips.ethereum.org/EIPS/eip-3085
export interface EIP3085Config {
    /** The integer ID of the chain as a hexadecimal string. */
    chainId: string;

    /** One or more URLs pointing to block explorer web sites for the chain. */
    blockExplorerUrls: string[] | null;

    /** A human-readable name for the chain. */
    chainName: string;

    /**
     * One or more URLs pointing to reasonably sized images that can be used to
     * visually identify the chain.
     */
    iconUrls?: string[];

    /** The native currency of the chain. */
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };

    /**
     * One or more URLs pointing to RPC endpoints that can be used to
     * communicate with the chain. Each chain may define variables that will be
     * replaced using the notation `${VARIABLE_NAME}`, such as
     * `${INFURA_API_KEY}`.
     */
    rpcUrls: string[];
}

export interface EVMNetworkConfig {
    selector: string;
    isTestnet?: boolean;
    logRequestLimit?: number;

    addresses: {
        GatewayRegistry: string;
        BasicBridge: string;
    };

    // Allow overriding values from EVMNetworkConfig.config.nativeCurrency
    nativeAsset: {
        name: string;
        symbol: string;
        decimals: number;
    };
    averageConfirmationTime: number;

    config: EIP3085Config;
}

export type EVMNetworkInput = RenNetwork | `${RenNetwork}` | EVMNetworkConfig;
export type EvmNetworkInput = EVMNetworkInput;

export type EthProvider =
    | string
    | {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sendAsync?: (request: any, callback: any) => any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          send?: (request: any, callback: any) => any;
          request?: (request: {
              method: string;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              params?: any[];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) => Promise<any>;
      }
    | ExternalProvider
    | JsonRpcFetchFunc
    | Provider;

export type EthSigner = ethers.Signer;

export interface EthereumClassConfig {
    logger?: Logger;
}
