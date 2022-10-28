import BigNumber from "bignumber.js";

export interface TerraNetworkConfig {
    selector: string;
    chainId: string;
    addressPrefix: string;
    isTestnet?: boolean;

    nativeAsset: {
        name: string;
        symbol: string;
        decimals: number;
    };
    averageConfirmationTime: number;
    explorer: string;
    apiUrl: string;
}

export const isTerraNetworkConfig = (
    renNetwork: unknown,
): renNetwork is TerraNetworkConfig =>
    !!(renNetwork as TerraNetworkConfig).selector &&
    !!(renNetwork as TerraNetworkConfig).chainId &&
    !!(renNetwork as TerraNetworkConfig).nativeAsset &&
    !!(renNetwork as TerraNetworkConfig).explorer &&
    !!(renNetwork as TerraNetworkConfig).apiUrl;

export interface TerraTransaction {
    hash: string;
    from: string;
    to: string;
    denomination: string;
    amount: string;
    memo: string;
    confirmations: number;
    messageIndex: number;
}

export interface TerraAPI {
    fetchDeposits: (
        address: string,
        memo?: string | undefined,
        page?: number,
    ) => Promise<TerraTransaction[]>;

    fetchConfirmations: (hash: string) => Promise<BigNumber>;
}
