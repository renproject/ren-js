import { RenNetwork } from "@renproject/interfaces";

import { StandardExplorer } from "./";
import { Ethereum, EthereumClassConfig } from "./ethereum";
import { EthProvider, EvmNetworkConfig, EvmNetworkInput } from "./utils/types";

export const avalancheMainnetConfig: EvmNetworkConfig = {
    name: "Avalanche",
    networkID: 137,
    rpcUrl: () => `https://api.avax.network/ext/bc/C/rpc`,
    explorer: StandardExplorer("https://cchain.explorer.avax.network"),
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicAdapter: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
};
export const avalancheTestnetConfig: EvmNetworkConfig = {
    name: "Avalanche Testnet",
    networkID: 80001,
    isTestnet: true,
    rpcUrl: () => `https://api.avax-test.network/ext/bc/C/rpc`,
    explorer: StandardExplorer("https://cchain.explorer.avax-test.network"),
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },
};

export class Avalanche extends Ethereum {
    public static chain = "Avalanche";
    public name = Avalanche.chain;
    public feeAsset: string = "AVAX";

    public static configMap = {
        [RenNetwork.Testnet]: avalancheTestnetConfig,
        [RenNetwork.Mainnet]: avalancheMainnetConfig,
    };
    public configMap = Avalanche.configMap;

    constructor(
        renNetwork: EvmNetworkInput,
        web3Provider: EthProvider,
        config?: EthereumClassConfig,
    ) {
        super(renNetwork, web3Provider, {
            ...config,
        });
    }
}
