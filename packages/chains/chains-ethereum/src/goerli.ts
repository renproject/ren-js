import { RenNetwork } from "@renproject/interfaces";

import { Ethereum, EthereumClassConfig } from "./ethereum";
import { EthProvider, EvmNetworkConfig, EvmNetworkInput } from "./utils/types";
import { StandardExplorer } from "./utils/utils";

export const goerliConfig: EvmNetworkConfig = {
    name: "Görli",
    networkID: 6284,
    isTestnet: true,
    rpcUrl: ({ infura }: { infura?: string } = {}) =>
        `https://goerli.infura.io/v3/${infura || ""}`,
    explorer: StandardExplorer("https://goerli.etherscan.io"),
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },
};

export class Goerli extends Ethereum {
    public static chain = "Goerli";
    public name = Goerli.chain;
    public feeAsset: string = "goerliETH";

    public static configMap = {
        [RenNetwork.Testnet]: goerliConfig,
    };
    public configMap = Goerli.configMap;

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
