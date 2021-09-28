import { RenNetwork } from "@renproject/interfaces";

import { Ethereum, EthereumClassConfig } from "./ethereum";
import { EthProvider, EvmNetworkConfig, EvmNetworkInput } from "./utils/types";
import { StandardExplorer } from "./utils/utils";

export const polygonTestnetConfig: EvmNetworkConfig = {
    name: "Polygon Testnet",
    networkID: 80001,
    isTestnet: true,
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },

    rpcUrl: () => `https://rpc-mumbai.maticvigil.com`,
    explorer: StandardExplorer("https://mumbai.polygonscan.com"),
};

export const polygonMainnetConfig: EvmNetworkConfig = {
    name: "Polygon",
    networkID: 137,
    rpcUrl: () => `https://rpc-mainnet.maticvigil.com`,
    explorer: StandardExplorer("https://polygonscan.com"),
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
};

export class Polygon extends Ethereum {
    public static chain = "Polygon";
    public name = Polygon.chain;
    public feeAsset: string = "MATIC";

    public static configMap = {
        [RenNetwork.Testnet]: polygonTestnetConfig,
        [RenNetwork.Mainnet]: polygonMainnetConfig,
    };
    public configMap = Polygon.configMap;

    constructor(
        renNetwork: EvmNetworkInput,
        web3Provider: EthProvider,
        config?: EthereumClassConfig,
    ) {
        super(renNetwork, web3Provider, {
            logRequestLimit: 1000,
            ...config,
        });
    }
}
