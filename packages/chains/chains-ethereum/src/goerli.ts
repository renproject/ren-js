import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";
import {
    EthereumClassConfig,
    EthProvider,
    EthSigner,
    EVMNetworkConfig,
    EVMNetworkInput,
    populateEVMNetwork,
} from "./utils/types";

const goerliConfig: EVMNetworkConfig = populateEVMNetwork({
    selector: "Goerli",

    nativeAsset: { name: "Görli Ether", symbol: "gETH", decimals: 18 },
    averageConfirmationTime: 15,

    config: {
        chainId: "0x5",
        chainName: "Görli",
        nativeCurrency: {
            name: "Görli Ether",
            symbol: "GOR",
            decimals: 18,
        },
        rpcUrls: [
            "https://rpc.goerli.mudit.blog/",
            "https://goerli.infura.io/v3/${INFURA_API_KEY}",
            "wss://goerli.infura.io/v3/${INFURA_API_KEY}",
        ],
        blockExplorerUrls: ["https://goerli.etherscan.io"],
    },

    addresses: {
        GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
    },
});

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
        network: EVMNetworkInput;
        provider: EthProvider;
        signer?: EthSigner;
        config?: EthereumClassConfig;
    }) {
        super({
            network: resolveEVMNetworkConfig(Goerli.configMap, network),
            provider,
            signer,
            config,
        });
    }
}
