import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";

const configMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: {
        selector: "Kava",

        nativeAsset: { name: "Kava", symbol: "KAVA", decimals: 18 },
        averageConfirmationTime: 1,
        logRequestLimit: 10000,

        config: {
            chainId: "0x8ad",
            chainName: "Kava EVM",
            nativeCurrency: { name: "Kava", symbol: "KAVA", decimals: 18 },
            rpcUrls: [
                "https://evm.kava.io",
                "https://evm2.kava.io",
                "wss://wevm.kava.io",
                "wss://wevm2.kava.io",
            ],
            blockExplorerUrls: ["https://explorer.kava.io"],
        },

        addresses: {
            // TODO: Fill out once available.
            GatewayRegistry: "",
            BasicBridge: "",
        },
    },

    [RenNetwork.Testnet]: {
        selector: "Kava",

        nativeAsset: { name: "Testnet Kava", symbol: "KAVA", decimals: 18 },
        averageConfirmationTime: 1,
        logRequestLimit: 10000,

        config: {
            chainId: "0x8ad",
            chainName: "Kava EVM Testnet",
            nativeCurrency: { name: "Kava", symbol: "KAVA", decimals: 18 },
            rpcUrls: [
                "https://evm.evm-alpha.kava.io",
                "wss://evm-ws.evm-alpha.kava.io",
            ],
            blockExplorerUrls: ["https://explorer.evm-alpha.kava.io"],
        },

        addresses: {
            GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
            BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
        },
    },
};

export class Kava extends EthereumBaseChain {
    // Static members.
    public static chain = "Kava" as const;
    public static configMap = configMap;
    public static assets = {
        KAVA: "KAVA" as const,
    };

    public configMap = configMap;
    public assets = Kava.assets;

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
