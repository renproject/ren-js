import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import {
    EthereumClassConfig,
    EthProvider,
    EvmNetworkConfig,
    EvmNetworkInput,
} from "./utils/types";
import { resolveEvmNetworkConfig } from "./utils/utils";

export const fantomMainnetConfig: EvmNetworkConfig = {
    selector: "Fantom",
    asset: "FTM",

    network: {
        chainId: "0xfa",
        chainName: "Fantom Opera",
        nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18 },
        rpcUrls: ["https://rpc.ftm.tools"],
        blockExplorerUrls: ["https://ftmscan.com"],
    },

    addresses: {
        GatewayRegistry: "0x21C482f153D0317fe85C60bE1F7fa079019fcEbD",
        BasicBridge: "0xAC23817f7E9Ec7EB6B7889BDd2b50e04a44470c5",
    },
};

export const fantomTestnetConfig: EvmNetworkConfig = {
    selector: "Fantom",
    asset: "FTM",

    network: {
        chainId: "0xfa2",
        chainName: "Fantom Testnet",
        nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18 },
        rpcUrls: ["https://rpc.testnet.fantom.network"],
        blockExplorerUrls: ["https://testnet.ftmscan.com/"],
    },

    addresses: {
        GatewayRegistry: "0x707bBd01A54958d1c0303b29CAfA9D9fB2D61C10",
        BasicBridge: "0x52aF1b09DC11B47DcC935877a7473E35D946b7C9",
    },
};

export const fantomDevnetConfig: EvmNetworkConfig = {
    ...fantomTestnetConfig,
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicBridge: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },
};

export class Fantom extends EthereumBaseChain {
    public static chain = "Fantom";

    public static configMap = {
        [RenNetwork.Testnet]: fantomTestnetConfig,
        [RenNetwork.Mainnet]: fantomMainnetConfig,
    };
    public configMap = Fantom.configMap;

    public static assets = {
        FTM: "FTM",
    };
    public assets = Fantom.assets;

    constructor(
        network: EvmNetworkInput,
        web3Provider: EthProvider,
        config: EthereumClassConfig = {},
    ) {
        super(
            resolveEvmNetworkConfig(Fantom.configMap, network),
            web3Provider,
            config,
        );
    }
}
