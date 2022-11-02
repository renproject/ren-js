import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";

const configMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: {
        selector: "Arbitrum",

        nativeAsset: { name: "Arbitrum Ether", symbol: "ArbETH", decimals: 18 },
        averageConfirmationTime: 4,

        config: {
            chainId: "0xa4b1",
            chainName: "Arbitrum One",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [
                "https://arb1.arbitrum.io/rpc",
                "https://rpc.ankr.com/arbitrum",
                "https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}",
                // "https://arbitrum-mainnet.infura.io/v3/${INFURA_API_KEY}",
            ],
            blockExplorerUrls: ["https://arbiscan.io"],
        },

        logRequestLimit: 20000,
        addresses: {
            GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
            BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
        },
    },
    [RenNetwork.Testnet]: {
        selector: "Arbitrum",
        isTestnet: true,

        nativeAsset: {
            name: "Arbitrum Görli Ether",
            symbol: "ArbETH",
            decimals: 18,
        },
        averageConfirmationTime: 4,

        config: {
            chainId: "0x66eeb",
            chainName: "Arbitrum Görli",
            nativeCurrency: {
                name: "Arbitrum Görli Ether",
                symbol: "ARETH",
                decimals: 18,
            },
            rpcUrls: [
                "https://goerli-rollup.arbitrum.io/rpc",
                "https://arb-goerli.g.alchemy.com/v2/${ALCHEMY_API_KEY}",
                "wss://arb-goerli.g.alchemy.com/v2/${ALCHEMY_API_KEY}",
            ],
            blockExplorerUrls: ["https://goerli.arbiscan.io"],
        },

        logRequestLimit: 20000,
        addresses: {
            GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
            BasicBridge: "0x081636b68aBD7695006e0baE4d8663b91EC5Cfc1",
        },
    },
};

/**
 * Arbitrum/arbETH configuration.
 */
export class Arbitrum extends EthereumBaseChain {
    // Static members.
    public static chain = "Arbitrum" as const;
    public static configMap = configMap;
    public static assets = {
        [RenNetwork.Mainnet]: { ArbETH: "ArbETH" as const },
        [RenNetwork.Testnet]: { ArbETH: "ArbETH" as const },
    };

    public configMap = configMap;
    public assets:
        | typeof Arbitrum.assets[RenNetwork.Mainnet]
        | typeof Arbitrum.assets[RenNetwork.Testnet];

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0]) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(configMap, network),
        });
        this.assets =
            Arbitrum.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
