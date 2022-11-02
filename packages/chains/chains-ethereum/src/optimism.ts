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
            rpcUrls: [
                "https://mainnet.optimism.io/",
                "https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}",
                "wss://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}",
            ],
            blockExplorerUrls: ["https://optimistic.etherscan.io"],
        },

        addresses: {
            GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
            BasicBridge: "0xa3FA9A73D22618FfdF6958Ba6285FB3F565e1443",
        },
    },

    [RenNetwork.Testnet]: {
        selector: "Optimism",

        nativeAsset: {
            name: "Optimism Görli Ether",
            symbol: "oETH",
            decimals: 18,
        },
        averageConfirmationTime: 5,
        logRequestLimit: 10000,

        config: {
            chainId: "0x45",
            chainName: "Optimism Görli",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [
                "https://goerli.optimism.io",
                "https://opt-goerli.g.alchemy.com/v2/${ALCHEMY_API_KEY}",
                "wss://opt-goerli.g.alchemy.com/v2/${ALCHEMY_API_KEY}",
            ],
            blockExplorerUrls: ["https://goerli-optimism.etherscan.io"],
        },

        addresses: {
            GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
            BasicBridge: "0x081636b68aBD7695006e0baE4d8663b91EC5Cfc1",
        },
    },
};

export class Optimism extends EthereumBaseChain {
    // Static members.
    public static chain = "Optimism" as const;
    public static configMap = configMap;
    public static assets = {
        [RenNetwork.Mainnet]: { oETH: "oETH" as const },
        [RenNetwork.Testnet]: { oETH: "oETH" as const },
    };

    public configMap = configMap;
    public assets:
        | typeof Optimism.assets[RenNetwork.Mainnet]
        | typeof Optimism.assets[RenNetwork.Testnet];

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0]) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(configMap, network),
        });
        this.assets =
            Optimism.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
