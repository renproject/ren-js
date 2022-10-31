import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";

const configMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: {
        selector: "Avalanche",

        nativeAsset: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
        averageConfirmationTime: 2,

        config: {
            chainId: "0xa86a",
            chainName: "Avalanche C-Chain",
            nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
            rpcUrls: [
                "https://api.avax.network/ext/bc/C/rpc",
                "https://rpc.ankr.com/avalanche",
                "https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc",
            ],
            blockExplorerUrls: ["https://snowtrace.io"],
        },

        logRequestLimit: 2048,
        addresses: {
            GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
            BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
        },
    },

    [RenNetwork.Testnet]: {
        selector: "Avalanche",
        isTestnet: true,

        nativeAsset: {
            name: "Testnet Avalanche",
            symbol: "AVAX",
            decimals: 18,
        },
        averageConfirmationTime: 2,

        config: {
            chainId: "0xa869",
            chainName: "Avalanche Fuji Testnet",
            nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
            rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
            blockExplorerUrls: ["https://testnet.snowtrace.io"],
        },

        logRequestLimit: 2048,
        addresses: {
            GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
            BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
        },
    },
};

/**
 * Avalanche/AVAX configuration.
 */
export class Avalanche extends EthereumBaseChain {
    // Static members.
    public static chain = "Avalanche" as const;
    public static configMap = configMap;
    public static assets = {
        [RenNetwork.Mainnet]: { AVAX: "AVAX" as const },
        [RenNetwork.Testnet]: { AVAX: "AVAX" as const },
    };

    public configMap = configMap;
    public assets:
        | typeof Avalanche.assets[RenNetwork.Mainnet]
        | typeof Avalanche.assets[RenNetwork.Testnet];

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0]) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(configMap, network),
        });
        this.assets =
            Avalanche.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
