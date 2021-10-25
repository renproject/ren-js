import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import {
    EthereumClassConfig,
    EthProvider,
    EvmNetworkConfig,
    EvmNetworkInput,
} from "./utils/types";
import { resolveEvmNetworkConfig } from "./utils/utils";

export const avalancheMainnetConfig: EvmNetworkConfig = {
    selector: "Avalanche",

    network: {
        chainId: "0xa86a",
        chainName: "Avalanche Mainnet",
        nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
        rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
        blockExplorerUrls: ["https://cchain.explorer.avax.network/"],
    },

    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
};
export const avalancheTestnetConfig: EvmNetworkConfig = {
    selector: "Avalanche",
    isTestnet: true,

    network: {
        chainId: "0xa869",
        chainName: "Avalanche Fuji Testnet",
        nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
        rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
        blockExplorerUrls: ["https://cchain.explorer.avax-test.network"],
    },

    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },
};

export class Avalanche extends EthereumBaseChain {
    public static chain = "Avalanche";

    public static configMap = {
        [RenNetwork.Testnet]: avalancheTestnetConfig,
        [RenNetwork.Mainnet]: avalancheMainnetConfig,
    };
    public configMap = Avalanche.configMap;

    constructor(
        network: EvmNetworkInput,
        web3Provider: EthProvider,
        config: EthereumClassConfig = {},
    ) {
        super(
            resolveEvmNetworkConfig(Avalanche.configMap, network),
            web3Provider,
            config,
        );
    }
}
