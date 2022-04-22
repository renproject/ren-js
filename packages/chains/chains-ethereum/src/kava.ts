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

const kavaMainnetConfig: EVMNetworkConfig = populateEVMNetwork({
    selector: "Kava",

    nativeAsset: { name: "Kava", symbol: "KAVA", decimals: 6 },
    averageConfirmationTime: 1,
    logRequestLimit: 10000,

    config: {
        chainId: "0xfa",
        chainName: "Kava Opera",
        nativeCurrency: { name: "Kava", symbol: "KAVA", decimals: 6 },
        rpcUrls: ["https://evm.evm-alpha.kava.io"],
        blockExplorerUrls: [""],
    },

    addresses: {
        GatewayRegistry: "",
        BasicBridge: "",
    },
});

const kavaTestnetConfig: EVMNetworkConfig = populateEVMNetwork({
    selector: "Kava",

    nativeAsset: { name: "Testnet Kava", symbol: "KAVA", decimals: 6 },
    averageConfirmationTime: 1,
    logRequestLimit: 10000,

    config: {
        chainId: "0x8ad",
        chainName: "Kava EVM Testnet",
        nativeCurrency: { name: "Kava", symbol: "KAVA", decimals: 18 },
        rpcUrls: [
            "https://evm.evm-alpha.kava.io",
            "wss://evm-ws.evm-alpha.kava.io",
        ],
        blockExplorerUrls: ["https://explorer.evm-alpha.kava.io"],
    },

    addresses: {
        GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
    },
});

const kavaDevnetConfig: EVMNetworkConfig = populateEVMNetwork({
    ...kavaTestnetConfig,
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicBridge: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },
});

export class Kava extends EthereumBaseChain {
    public static chain = "Kava";

    public static configMap = {
        [RenNetwork.Mainnet]: kavaMainnetConfig,
        [RenNetwork.Testnet]: kavaTestnetConfig,
        [RenNetwork.Devnet]: kavaDevnetConfig,
    };
    public configMap = Kava.configMap;

    public static assets = {
        KAVA: "KAVA",
    };
    public assets = Kava.assets;

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
            network: resolveEVMNetworkConfig(Kava.configMap, network),
            provider,
            signer,
            config,
        });
    }
}
