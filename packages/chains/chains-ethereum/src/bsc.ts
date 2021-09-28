import { RenNetwork } from "@renproject/interfaces";

import { Ethereum, EthereumClassConfig } from "./ethereum";
import { EthProvider, EvmNetworkConfig, EvmNetworkInput } from "./utils/types";
import { StandardExplorer } from "./utils/utils";

export const bscMainnetConfig: EvmNetworkConfig = {
    name: "Binance Smart Chain",
    networkID: 56,
    rpcUrl: () => `https://bsc-dataseed.binance.org`,
    explorer: StandardExplorer("https://bscscan.com"),
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
};

export const bscTestnetConfig: EvmNetworkConfig = {
    name: "BSC Testnet",
    networkID: 97,
    isTestnet: true,
    rpcUrl: () => `https://data-seed-prebsc-1-s1.binance.org:8545/`,
    explorer: StandardExplorer("https://testnet.bscscan.com"),
    addresses: {
        GatewayRegistry: "0x707bBd01A54958d1c0303b29CAfA9D9fB2D61C10",
        BasicAdapter: "0x52aF1b09DC11B47DcC935877a7473E35D946b7C9",
    },
};

export const bscDevnetConfig: EvmNetworkConfig = {
    ...bscTestnetConfig,
    addresses: {
        GatewayRegistry: "0x87e83f957a2F3A2E5Fe16d5C6B22e38FD28bdc06",
        BasicAdapter: "0x105435a9b0f375B179e5e43A16228C04F01Fb2ee",
    },
};

export class BinanceSmartChain extends Ethereum {
    public static chain = "BinanceSmartChain";
    public name = BinanceSmartChain.chain;
    public feeAsset: string = "BNB";

    public static configMap = {
        [RenNetwork.Mainnet]: bscMainnetConfig,
        [RenNetwork.Testnet]: bscTestnetConfig,
        [RenNetwork.Devnet]: bscDevnetConfig,
    };
    public configMap = BinanceSmartChain.configMap;

    constructor(
        renNetwork: EvmNetworkInput,
        web3Provider: EthProvider,
        config?: EthereumClassConfig,
    ) {
        super(renNetwork, web3Provider, {
            logRequestLimit: 5000,
            ...config,
        });
    }
}
