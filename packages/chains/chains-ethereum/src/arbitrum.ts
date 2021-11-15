import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import {
    EthereumClassConfig,
    EthProvider,
    EvmNetworkConfig,
    EvmNetworkInput,
} from "./utils/types";
import { resolveEvmNetworkConfig } from "./utils/utils";

export const arbitrumMainnetConfig: EvmNetworkConfig = {
    selector: "Arbitrum",
    asset: "arbETH",

    network: {
        chainId: "0xa4b1",
        chainName: "Arbitrum One",
        nativeCurrency: { name: "Ether", symbol: "AETH", decimals: 18 },
        rpcUrls: [
            "https://arb1.arbitrum.io/rpc",
            "https://arbitrum-mainnet.infura.io/v3/${INFURA_API_KEY}",
            "https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}",
            "wss://arb1.arbitrum.io/ws",
        ],
        blockExplorerUrls: [
            "https://arbiscan.io",
            "https://explorer.arbitrum.io",
        ],
    },

    logRequestLimit: 20000,
    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicBridge: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
};

export const arbitrumTestnetConfig: EvmNetworkConfig = {
    selector: "Arbitrum",
    asset: "arbETH",
    isTestnet: true,

    network: {
        chainId: "0x66eeb",
        chainName: "Arbitrum Testnet Rinkeby",
        nativeCurrency: {
            name: "Arbitrum Rinkeby Ether",
            symbol: "ARETH",
            decimals: 18,
        },
        rpcUrls: [
            "https://rinkeby.arbitrum.io/rpc",
            "wss://rinkeby.arbitrum.io/ws",
        ],
        blockExplorerUrls: [
            "https://testnet.arbiscan.io/",
            "https://rinkeby-explorer.arbitrum.io",
        ],
    },

    logRequestLimit: 20000,
    addresses: {
        GatewayRegistry: "0x707bBd01A54958d1c0303b29CAfA9D9fB2D61C10",
        BasicBridge: "0x1156663dFab56A9BAdd844e12eDD69eC96Dd0eFb",
    },
};

/**
 * Arbitrum/arbETH configuration.
 */
export class Arbitrum extends EthereumBaseChain {
    public static chain = "Arbitrum";

    public static configMap = {
        [RenNetwork.Testnet]: arbitrumTestnetConfig,
        [RenNetwork.Mainnet]: arbitrumMainnetConfig,
    };
    public configMap = Arbitrum.configMap;

    public static assets = {
        arbETH: "arbETH",
    };
    public assets = Arbitrum.assets;

    constructor(
        network: EvmNetworkInput,
        web3Provider: EthProvider,
        config: EthereumClassConfig = {},
    ) {
        super(
            resolveEvmNetworkConfig(Arbitrum.configMap, network),
            web3Provider,
            config,
        );
    }
}
