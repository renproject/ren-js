import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import {
    EthereumClassConfig,
    EthProvider,
    EthSigner,
    EvmNetworkConfig,
    EvmNetworkInput,
} from "./utils/types";
import { resolveEvmNetworkConfig } from "./utils/utils";

const goerliConfig: EvmNetworkConfig = {
    selector: "Goerli",

    nativeAsset: { name: "Görli Ether", symbol: "gETH", decimals: 18 },
    averageConfirmationTime: 15,

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
        GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
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

    public constructor({
        network,
        provider,
        signer,
        config,
    }: {
        network: EvmNetworkInput;
        provider: EthProvider;
        signer?: EthSigner;
        config?: EthereumClassConfig;
    }) {
        super({
            network: resolveEvmNetworkConfig(Goerli.configMap, network),
            provider,
            signer,
            config,
        });
    }
}
