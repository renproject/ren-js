import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";

const configMap: EthereumBaseChain["configMap"] = {
    [RenNetwork.Mainnet]: {
        selector: "Polygon",

        nativeAsset: { name: "Matic", symbol: "MATIC", decimals: 18 },
        averageConfirmationTime: 4,

        config: {
            chainId: "0x89",
            chainName: "Polygon Mainnet",
            nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
            rpcUrls: [
                "https://polygon-rpc.com",
                "https://rpc-mainnet.matic.network",
                "https://matic-mainnet.chainstacklabs.com",
                "https://rpc-mainnet.maticvigil.com",
                "https://rpc-mainnet.matic.quiknode.pro",
                "https://matic-mainnet-full-rpc.bwarelabs.com",
                "https://matic-mainnet-archive-rpc.bwarelabs.com",
                "https://poly-rpc.gateway.pokt.network",
                "https://rpc.ankr.com/polygon",
                "https://polygon-mainnet.public.blastapi.io",
            ],
            blockExplorerUrls: ["https://polygonscan.com"],
        },

        logRequestLimit: 1000,
        addresses: {
            GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
            BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
        },
    },

    [RenNetwork.Testnet]: {
        selector: "Polygon",
        isTestnet: true,

        nativeAsset: { name: "Testnet Matic", symbol: "MATIC", decimals: 18 },
        averageConfirmationTime: 4,

        config: {
            chainId: "0x13881",
            chainName: "Mumbai",
            nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
            rpcUrls: [
                "https://matic-mumbai.chainstacklabs.com",
                "https://rpc-mumbai.maticvigil.com",
                "https://matic-testnet-archive-rpc.bwarelabs.com",
            ],
            blockExplorerUrls: ["https://mumbai.polygonscan.com"],
        },

        logRequestLimit: 1000,
        addresses: {
            GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
            BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
        },
    },
};

export class Polygon extends EthereumBaseChain {
    // Static members.
    public static chain = "Polygon" as const;
    public static configMap = configMap;
    public static assets = {
        MATIC: "MATIC" as const,
    };

    public configMap = configMap;
    public assets = Polygon.assets;

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
