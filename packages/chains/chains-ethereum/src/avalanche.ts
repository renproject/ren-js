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
    asset: "AVAX",

    network: {
        chainId: "0xa86a",
        chainName: "Avalanche Mainnet",
        nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
        rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
        blockExplorerUrls: ["https://cchain.explorer.avax.network/"],
    },

    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicBridge: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
};
export const avalancheTestnetConfig: EvmNetworkConfig = {
    selector: "Avalanche",
    asset: "AVAX",
    isTestnet: true,

    network: {
        chainId: "0xa869",
        chainName: "Avalanche Fuji Testnet",
        nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
        rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
        blockExplorerUrls: ["https://cchain.explorer.avax-test.network"],
    },

    addresses: {
        GatewayRegistry: "0x707bBd01A54958d1c0303b29CAfA9D9fB2D61C10",
        BasicBridge: "0x52aF1b09DC11B47DcC935877a7473E35D946b7C9",
    },
};

/**
 * Avalanche/AVAX configuration.
 */
export class Avalanche extends EthereumBaseChain {
    public static chain = "Avalanche";

    public static configMap = {
        [RenNetwork.Testnet]: avalancheTestnetConfig,
        [RenNetwork.Mainnet]: avalancheMainnetConfig,
    };
    public configMap = Avalanche.configMap;

    public static assets = {
        AVAX: "AVAX",
    };
    public assets = Avalanche.assets;

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
