import { RenNetwork } from "@renproject/interfaces";

import { EthereumBaseChain, EthereumClassConfig } from "./base";
import { EthProvider, EvmNetworkConfig, EvmNetworkInput } from "./utils/types";
import { resolveEvmNetworkConfig } from "./utils/utils";

export const goerliConfig: EvmNetworkConfig = {
    selector: "Goerli",

    network: {
        chainId: "0x5",
        chainName: "Ethereum Testnet Görli",
        nativeCurrency: { name: "Görli Ether", symbol: "GOR", decimals: 18 },
        rpcUrls: [
            "https://rpc.goerli.mudit.blog/",
            "https://rpc.slock.it/goerli ",
            "https://goerli.prylabs.net/",
        ],
        blockExplorerUrls: ["https://goerli.infura.io"],
    },

    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },
};

export class Goerli extends EthereumBaseChain {
    public static chain = "Goerli";

    public static configMap = {
        [RenNetwork.Testnet]: goerliConfig,
    };
    public configMap = Goerli.configMap;

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
