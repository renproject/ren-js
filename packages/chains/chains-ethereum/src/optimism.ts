import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";

const configMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: {
        selector: "Optimism",

        nativeAsset: { name: "Optimism Ether", symbol: "oETH", decimals: 18 },
        averageConfirmationTime: 5,
        logRequestLimit: 10000,

        config: {
            chainId: "0xA",
            chainName: "Optimism",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://mainnet.optimism.io/"],
            blockExplorerUrls: ["https://optimistic.etherscan.io"],
        },

        addresses: {
            GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
            BasicBridge: "0xa3FA9A73D22618FfdF6958Ba6285FB3F565e1443",
        },
    },

    [RenNetwork.Testnet]: {
        selector: "Optimism",

        nativeAsset: { name: "Optimism Ether", symbol: "oETH", decimals: 18 },
        averageConfirmationTime: 5,
        logRequestLimit: 10000,

        config: {
            chainId: "0x45",
            chainName: "Optimism",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://kovan.optimism.io/"],
            blockExplorerUrls: ["https://kovan-optimistic.etherscan.io"],
        },

        addresses: {
            GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
            BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
        },
    },
};

export class Optimism extends EthereumBaseChain {
    // Static members.
    public static chain = "Optimism" as const;
    public static configMap = configMap;
    public static assets = {
        oETH: "oETH" as const,
    };

    public configMap = configMap;
    public assets = Optimism.assets;

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
