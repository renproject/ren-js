import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import {
    EthereumClassConfig,
    EthProvider,
    EvmNetworkConfig,
    EvmNetworkInput,
} from "./utils/types";
import { resolveEvmNetworkConfig } from "./utils/utils";

export const polygonMainnetConfig: EvmNetworkConfig = {
    selector: "Polygon",
    asset: "MATIC",

    network: {
        chainId: "0x89",
        chainName: "Matic(Polygon) Mainnet",
        nativeCurrency: { name: "Matic", symbol: "MATIC", decimals: 18 },
        rpcUrls: [
            "https://rpc-mainnet.maticvigil.com",
            "https://rpc-mainnet.matic.network",
            "wss://ws-mainnet.matic.network",
            "https://rpc-mainnet.matic.quiknode.pro",
            "https://matic-mainnet.chainstacklabs.com",
        ],
        blockExplorerUrls: ["https://polygonscan.com"],
    },

    logRequestLimit: 1000,
    addresses: {
        GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
        BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
    },
};

export const polygonTestnetConfig: EvmNetworkConfig = {
    selector: "Polygon",
    asset: "MATIC",
    isTestnet: true,

    network: {
        chainId: "0x13881",
        chainName: "Matic(Polygon) Testnet Mumbai",
        nativeCurrency: { name: "Matic", symbol: "tMATIC", decimals: 18 },
        rpcUrls: [
            "https://rpc-mumbai.maticvigil.com",
            "https://rpc-mumbai.matic.today",
            "wss://ws-mumbai.matic.today",
        ],
        blockExplorerUrls: ["https://mumbai.polygonscan.com/"],
    },

    logRequestLimit: 1000,
    addresses: {
        GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
    },
};

export class Polygon extends EthereumBaseChain {
    public static chain = "Polygon";
    public static configMap = {
        [RenNetwork.Testnet]: polygonTestnetConfig,
        [RenNetwork.Mainnet]: polygonMainnetConfig,
    };
    public configMap = Polygon.configMap;

    public static assets = {
        MATIC: "MATIC",
    };
    public assets = Polygon.assets;

    public constructor(
        network: EvmNetworkInput,
        web3Provider: EthProvider,
        config: EthereumClassConfig = {},
    ) {
        super(
            resolveEvmNetworkConfig(Polygon.configMap, network),
            web3Provider,
            config,
        );
    }
}
