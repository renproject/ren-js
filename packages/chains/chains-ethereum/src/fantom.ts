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

const fantomMainnetConfig: EVMNetworkConfig = populateEVMNetwork({
    selector: "Fantom",

    nativeAsset: { name: "Fantom", symbol: "FTM", decimals: 18 },
    averageConfirmationTime: 1,

    config: {
        chainId: "0xfa",
        chainName: "Fantom Opera",
        nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18 },
        rpcUrls: [
            "https://rpc.ftm.tools",
            "https://fantom-mainnet.gateway.pokt.network/v1/lb/62759259ea1b320039c9e7ac",
            "https://rpc.ankr.com/fantom",
            "https://rpc.fantom.network",
            "https://rpc2.fantom.network",
            "https://rpc3.fantom.network",
            "https://rpcapi.fantom.network",
            "https://fantom-mainnet.public.blastapi.io",
        ],
        blockExplorerUrls: ["https://ftmscan.com"],
    },

    addresses: {
        GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
        BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
    },
});

const fantomTestnetConfig: EVMNetworkConfig = populateEVMNetwork({
    selector: "Fantom",

    nativeAsset: { name: "Testnet Fantom", symbol: "FTM", decimals: 18 },
    averageConfirmationTime: 1,

    config: {
        chainId: "0xfa2",
        chainName: "Fantom Testnet",
        nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18 },
        rpcUrls: ["https://rpc.testnet.fantom.network"],
        blockExplorerUrls: ["https://testnet.ftmscan.com"],
    },

    addresses: {
        GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
    },
});

const fantomDevnetConfig: EVMNetworkConfig = populateEVMNetwork({
    ...fantomTestnetConfig,
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicBridge: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },
});

export class Fantom extends EthereumBaseChain {
    public static chain = "Fantom";

    public static configMap = {
        [RenNetwork.Mainnet]: fantomMainnetConfig,
        [RenNetwork.Testnet]: fantomTestnetConfig,
        [RenNetwork.Devnet]: fantomDevnetConfig,
    };
    public configMap = Fantom.configMap;

    public static assets = {
        FTM: "FTM",
    };
    public assets = Fantom.assets;

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
            network: resolveEVMNetworkConfig(Fantom.configMap, network),
            provider,
            signer,
            config,
        });
    }
}
