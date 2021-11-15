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
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicBridge: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
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
        GatewayRegistry: "0x707bBd01A54958d1c0303b29CAfA9D9fB2D61C10",
        BasicBridge: "0x52aF1b09DC11B47DcC935877a7473E35D946b7C9",
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

    constructor(
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
