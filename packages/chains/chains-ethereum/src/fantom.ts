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
        GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
        BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
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
        GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
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

    public constructor(
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
