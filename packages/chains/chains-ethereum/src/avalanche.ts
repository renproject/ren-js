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

const avalancheMainnetConfig: EvmNetworkConfig = {
    selector: "Avalanche",
    asset: "AVAX",

    network: {
        chainId: "0xa86a",
        chainName: "Avalanche Mainnet",
        nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
        rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
        blockExplorerUrls: ["https://snowtrace.io/"],
    },

    addresses: {
        GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
        BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
    },
};
const avalancheTestnetConfig: EvmNetworkConfig = {
    selector: "Avalanche",
    asset: "AVAX",
    isTestnet: true,

    network: {
        chainId: "0xa869",
        chainName: "Avalanche Fuji Testnet",
        nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
        rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
        blockExplorerUrls: ["https://testnet.snowtrace.io/"],
    },

    addresses: {
        GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
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
            network: resolveEvmNetworkConfig(Avalanche.configMap, network),
            provider,
            signer,
            config,
        });
    }
}
