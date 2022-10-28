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
            blockExplorerUrls: null,
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
            blockExplorerUrls: null,
        },

        addresses: {
            GatewayRegistry: "0x44c2CdaE368F90544A01522C413376fC72ebd4F2",
            BasicBridge: "0xfc5681F4343803C11eB5Bb7aFd2108238bbd7177",
        },
    },
};

/**
 * Catalog configuration.
 */
export class Catalog extends EthereumBaseChain {
    // Static members.
    public static chain = "Catalog" as const;
    public static configMap = configMap;
    public static assets = {
        [RenNetwork.Mainnet]: {},
        [RenNetwork.Testnet]: {},
    };

    public configMap = configMap;
    public assets:
        | typeof Catalog.assets[RenNetwork.Mainnet]
        | typeof Catalog.assets[RenNetwork.Testnet];

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0]) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(configMap, network),
        });
        this.assets =
            Catalog.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
