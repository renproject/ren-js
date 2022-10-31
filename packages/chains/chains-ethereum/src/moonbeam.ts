import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";

const configMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: {
        selector: "Moonbeam",

        nativeAsset: { name: "Glimmer", symbol: "GLMR", decimals: 18 },
        averageConfirmationTime: 12,
        logRequestLimit: 2000,

        config: {
            chainId: "0x504",
            chainName: "Moonbeam",
            nativeCurrency: { name: "Glimmer", symbol: "GLMR", decimals: 18 },
            rpcUrls: [
                "https://rpc.api.moonbeam.network",
                "wss://wss.api.moonbeam.network",
            ],
            blockExplorerUrls: ["https://moonbeam.moonscan.io"],
        },

        addresses: {
            GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
            BasicBridge: "0xa3FA9A73D22618FfdF6958Ba6285FB3F565e1443",
        },
    },

    [RenNetwork.Testnet]: {
        selector: "Moonbeam",

        nativeAsset: { name: "Glimmer", symbol: "GLMR", decimals: 18 },
        averageConfirmationTime: 12,
        logRequestLimit: 2000,

        config: {
            chainId: "0x507",
            chainName: "Moonbase Alpha",
            nativeCurrency: { name: "Dev", symbol: "DEV", decimals: 18 },
            rpcUrls: [
                "https://rpc.api.moonbase.moonbeam.network",
                "https://rpc.testnet.moonbeam.network",
            ],
            blockExplorerUrls: ["https://moonbase.moonscan.io"],
        },

        addresses: {
            GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
            BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
        },
    },
};

export class Moonbeam extends EthereumBaseChain {
    // Static members.
    public static chain = "Moonbeam" as const;
    public static configMap = configMap;
    public static assets = {
        [RenNetwork.Mainnet]: { GLMR: "GLMR" as const },
        [RenNetwork.Testnet]: { GLMR: "GLMR" as const },
    };

    public configMap = configMap;
    public assets:
        | typeof Moonbeam.assets[RenNetwork.Mainnet]
        | typeof Moonbeam.assets[RenNetwork.Testnet];

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0]) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(configMap, network),
        });
        this.assets =
            Moonbeam.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
