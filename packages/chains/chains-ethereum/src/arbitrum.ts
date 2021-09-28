import { RenNetwork } from "@renproject/interfaces";

import { Ethereum, EthereumClassConfig } from "./ethereum";
import { EthProvider, EvmNetworkConfig, EvmNetworkInput } from "./utils/types";
import { StandardExplorer } from "./utils/utils";

export const arbitrumMainnetConfig: EvmNetworkConfig = {
    name: "Arbitrum",
    networkID: 42161,
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },

    rpcUrl: () => `https://arb1.arbitrum.io/rpc`,
    explorer: StandardExplorer("https://explorer.arbitrum.io"),
};

export const arbitrumTestnetConfig: EvmNetworkConfig = {
    name: "Arbitrum Testnet",
    networkID: 421611,
    isTestnet: true,
    addresses: {
        GatewayRegistry: "0x5eEBf6c199a9Db26dabF621fB8c43D58C62DF2bd",
        BasicAdapter: "0x1156663dFab56A9BAdd844e12eDD69eC96Dd0eFb",
    },

    rpcUrl: () => `https://rinkeby.arbitrum.io/rpc`,
    explorer: StandardExplorer("https://rinkeby-explorer.arbitrum.io"),
};

export class Arbitrum extends Ethereum {
    public static chain = "Arbitrum";
    public name = Arbitrum.chain;
    public feeAsset: string = "arbitrumETH";

    public static configMap = {
        [RenNetwork.Testnet]: arbitrumTestnetConfig,
        [RenNetwork.Mainnet]: arbitrumMainnetConfig,
    };
    public configMap = Arbitrum.configMap;

    constructor(
        renNetwork: EvmNetworkInput,
        web3Provider: EthProvider,
        config?: EthereumClassConfig,
    ) {
        super(renNetwork, web3Provider, {
            logRequestLimit: 20000,
            ...config,
        });
    }
}
