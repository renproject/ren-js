import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";

const configMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: {
        selector: "Kava",

        nativeAsset: { name: "Kava", symbol: "KAVA", decimals: 18 },
        averageConfirmationTime: 5,
        logRequestLimit: 10000,

        config: {
            chainId: "0x8ae",
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
            GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
            BasicBridge: "0xa3FA9A73D22618FfdF6958Ba6285FB3F565e1443",
        },
    },

    [RenNetwork.Testnet]: {
        selector: "Kava",

        nativeAsset: { name: "Testnet Kava", symbol: "KAVA", decimals: 18 },
        averageConfirmationTime: 5,
        logRequestLimit: 10000,

        config: {
            chainId: "0x8ad",
            chainName: "Kava EVM Testnet",
            nativeCurrency: { name: "Kava", symbol: "KAVA", decimals: 18 },
            rpcUrls: [
                "https://evm.testnet.kava.io",
                "wss://wevm.testnet.kava.io",
            ],
            blockExplorerUrls: ["https://explorer.testnet.kava.io"],
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
        [RenNetwork.Mainnet]: { KAVA: "KAVA" as const },
        [RenNetwork.Testnet]: { KAVA: "KAVA" as const },
    };

    public configMap = configMap;
    public assets:
        | typeof Kava.assets[RenNetwork.Mainnet]
        | typeof Kava.assets[RenNetwork.Testnet];

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0]) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(configMap, network),
        });
        this.assets =
            Kava.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
