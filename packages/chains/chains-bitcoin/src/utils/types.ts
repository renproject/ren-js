import {
    ChainTransaction,
    RenNetwork,
    RenNetworkString,
} from "@renproject/utils";

import { APIWithPriority, BitcoinAPI } from "../APIs/API";

export type BitcoinInputPayload =
    | {
          chain: string;
          type?: "gatewayAddress";
      }
    | {
          chain: string;
          type: "transaction";
          params: {
              tx: ChainTransaction;
          };
      };

export interface BitcoinOutputPayload {
    chain: string;
    type?: "address";
    /**
     * @deprecated Use params.address instead.
     */
    address?: string;
    params?: {
        address: string;
    };
}

export interface BitcoinNetworkConfig {
    label: string;

    selector: string;

    nativeAsset: {
        name: string;
        symbol: string;
        decimals: number;
    };
    averageConfirmationTime: number;

    isTestnet?: boolean;
    p2shPrefix: Buffer;
    explorer: {
        url: string;
        address: (address: string) => string;
        transaction: (txid: string) => string;
    };
    providers: Array<BitcoinAPI | APIWithPriority>;
}

export const isBitcoinNetworkConfig = (
    input: unknown,
): input is BitcoinNetworkConfig =>
    !!(input as BitcoinNetworkConfig).label &&
    !!(input as BitcoinNetworkConfig).selector &&
    !!(input as BitcoinNetworkConfig).nativeAsset &&
    !!(input as BitcoinNetworkConfig).p2shPrefix &&
    !!(input as BitcoinNetworkConfig).explorer &&
    !!(input as BitcoinNetworkConfig).providers;

export type BitcoinNetworkConfigMap = {
    [network in RenNetwork]?: BitcoinNetworkConfig;
};

export type BitcoinNetworkInput =
    | RenNetwork
    | RenNetworkString
    | BitcoinNetworkConfig;
