import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";

const configMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: {
        selector: "Catalog",

        nativeAsset: { name: "DCE EVM", symbol: "dceETH", decimals: 18 },
        averageConfirmationTime: 15,

        config: {
            chainId: "0xC30",
            chainName: "Catalog Mainnet",
            nativeCurrency: { name: "DCE EVM", symbol: "dceETH", decimals: 18 },
            rpcUrls: ["https://mainnet.catalog.fi/rpc"],
            blockExplorerUrls: [""],
        },

        addresses: {
            GatewayRegistry: "0x44c2CdaE368F90544A01522C413376fC72ebd4F2",
            BasicBridge: "0x5D952fA25eD90b1151473d57F2B6C6DB568b865d",
        },
    },

    [RenNetwork.Testnet]: {
        selector: "Catalog",

        nativeAsset: { name: "DCE EVM", symbol: "dceETH", decimals: 18 },
        averageConfirmationTime: 15,

        config: {
            chainId: "0x47EE",
            chainName: "Catalog Testnet",
            nativeCurrency: { name: "DCE EVM", symbol: "dceETH", decimals: 18 },
            rpcUrls: ["https://rpc.catalog.fi/testnet"],
            blockExplorerUrls: [""],
        },

        addresses: {
            GatewayRegistry: "0x44c2CdaE368F90544A01522C413376fC72ebd4F2",
            BasicBridge: "0x5D952fA25eD90b1151473d57F2B6C6DB568b865d",
        },
    },
};

/**
 * Catalog configuration.
 */
export class Catalog extends EthereumBaseChain {
    public static chain = "Catalog";
    public static configMap = configMap;
    public static assets = {};

    public configMap = configMap;
    public assets = Catalog.assets;

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0]) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(configMap, network),
        });
    }
}
