import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";

const configMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: {
        selector: "Fantom",

        nativeAsset: { name: "Fantom", symbol: "FTM", decimals: 18 },
        averageConfirmationTime: 1,

        config: {
            chainId: "0xfa",
            chainName: "Fantom Opera",
            nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18 },
            rpcUrls: [
                "https://rpc.ftm.tools",
                "https://fantom-mainnet.gateway.pokt.network/v1/lb/62759259ea1b320039c9e7ac",
                "https://rpc.ankr.com/fantom",
                "https://rpc.fantom.network",
                "https://rpc2.fantom.network",
                "https://rpc3.fantom.network",
                "https://rpcapi.fantom.network",
                "https://fantom-mainnet.public.blastapi.io",
            ],
            blockExplorerUrls: ["https://ftmscan.com"],
        },

        addresses: {
            GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
            BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
        },
    },

    [RenNetwork.Testnet]: {
        selector: "Fantom",

        nativeAsset: { name: "Testnet Fantom", symbol: "FTM", decimals: 18 },
        averageConfirmationTime: 1,

        config: {
            chainId: "0xfa2",
            chainName: "Fantom Testnet",
            nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18 },
            rpcUrls: ["https://rpc.testnet.fantom.network"],
            blockExplorerUrls: ["https://testnet.ftmscan.com"],
        },

        addresses: {
            GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
            BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
        },
    },
};

export class Fantom extends EthereumBaseChain {
    // Static members.
    public static chain = "Fantom" as const;
    public static configMap = configMap;
    public static assets = {
        [RenNetwork.Mainnet]: { FTM: "FTM" as const },
        [RenNetwork.Testnet]: { FTM: "FTM" as const },
    };

    public configMap = Fantom.configMap;
    public assets:
        | typeof Fantom.assets[RenNetwork.Mainnet]
        | typeof Fantom.assets[RenNetwork.Testnet];

    public constructor({
        network,
        ...params
    }: ConstructorParameters<typeof EthereumBaseChain>[0]) {
        super({
            ...params,
            network: resolveEVMNetworkConfig(configMap, network),
        });
        this.assets =
            Fantom.assets[
                this.network.isTestnet ? RenNetwork.Testnet : RenNetwork.Mainnet
            ];
    }
}
