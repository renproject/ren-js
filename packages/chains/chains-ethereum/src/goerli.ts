import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import {
    EthereumClassConfig,
    EthProvider,
    EvmNetworkConfig,
    EvmNetworkInput,
} from "./utils/types";
import { resolveEvmNetworkConfig } from "./utils/utils";

export const goerliConfig: EvmNetworkConfig = {
    selector: "Goerli",
    asset: "gETH",

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
        GatewayRegistry: "0x707bBd01A54958d1c0303b29CAfA9D9fB2D61C10",
        BasicBridge: "0x52aF1b09DC11B47DcC935877a7473E35D946b7C9",
    },
};

export class Goerli extends EthereumBaseChain {
    public static chain = "Goerli";

    public static configMap = {
        [RenNetwork.Testnet]: goerliConfig,
    };
    public configMap = Goerli.configMap;

    public static assets = {
        gETH: "gETH",
    };
    public assets = Goerli.assets;

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
