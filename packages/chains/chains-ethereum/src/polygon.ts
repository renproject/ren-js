import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { Goerli } from "./goerli";
import {
    EthereumClassConfig,
    EthProvider,
    EvmNetworkConfig,
    EvmNetworkInput,
} from "./utils/types";
import { resolveEvmNetworkConfig } from "./utils/utils";

export const polygonTestnetConfig: EvmNetworkConfig = {
    selector: "Polygon",
    isTestnet: true,

    network: {
        chainId: "0x89",
        chainName: "Matic(Polygon) Mainnet",
        nativeCurrency: { name: "Matic", symbol: "MATIC", decimals: 18 },
        rpcUrls: [
            "https://rpc-mainnet.matic.network",
            "wss://ws-mainnet.matic.network",
            "https://rpc-mainnet.matic.quiknode.pro",
            "https://matic-mainnet.chainstacklabs.com",
        ],
        blockExplorerUrls: ["https://polygonscan.com"],
    },

    logRequestLimit: 1000,
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },
};

export const polygonMainnetConfig: EvmNetworkConfig = {
    selector: "Polygon",

    network: {
        chainId: "0x13881",
        chainName: "Matic(Polygon) Testnet Mumbai",
        nativeCurrency: { name: "Matic", symbol: "tMATIC", decimals: 18 },
        rpcUrls: [
            "https://rpc-mumbai.matic.today",
            "wss://ws-mumbai.matic.today",
        ],
        blockExplorerUrls: ["https://mumbai.polygonscan.com/"],
    },

    logRequestLimit: 1000,
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
};

export class Polygon extends EthereumBaseChain {
    public static chain = "Polygon";
    public static configMap = {
        [RenNetwork.Testnet]: polygonTestnetConfig,
        [RenNetwork.Mainnet]: polygonMainnetConfig,
    };
    public configMap = Polygon.configMap;

    constructor(
        network: EvmNetworkInput,
        web3Provider: EthProvider,
        config: EthereumClassConfig = {},
    ) {
        super(
            resolveEvmNetworkConfig(Goerli.configMap, network),
            web3Provider,
            config,
        );
    }
}
