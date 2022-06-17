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

const renChainMainnetConfig: EVMNetworkConfig = populateEVMNetwork({
    selector: "Catalog",

    nativeAsset: { name: "DCE EVM", symbol: "dceETH", decimals: 18 },
    averageConfirmationTime: 15,

    config: {
        chainId: "0xC30",
        chainName: "Catalog Mainnet",
        nativeCurrency: { name: "DCE EVM", symbol: "dceETH", decimals: 18 },
        rpcUrls: ["https://mainnet.catalog.fi/rpc"],
        blockExplorerUrls: [""],
    },

    addresses: {
        GatewayRegistry: "0x44c2CdaE368F90544A01522C413376fC72ebd4F2",
        BasicBridge: "0x5D952fA25eD90b1151473d57F2B6C6DB568b865d",
    },
});

const renChainTestnetConfig: EVMNetworkConfig = populateEVMNetwork({
    selector: "Catalog",

    nativeAsset: { name: "DCE EVM", symbol: "dceETH", decimals: 18 },
    averageConfirmationTime: 15,

    config: {
        chainId: "0x47EE",
        chainName: "Catalog Testnet",
        nativeCurrency: { name: "DCE EVM", symbol: "dceETH", decimals: 18 },
        rpcUrls: ["https://rpc.catalog.fi/testnet"],
        blockExplorerUrls: [""],
    },

    addresses: {
        GatewayRegistry: "0x44c2CdaE368F90544A01522C413376fC72ebd4F2",
        BasicBridge: "0x5D952fA25eD90b1151473d57F2B6C6DB568b865d",
    },
});

/**
 * Catalog configuration.
 */
export class Catalog extends EthereumBaseChain {
    public static chain = "Catalog";

    public static configMap = {
        [RenNetwork.Testnet]: renChainTestnetConfig,
        [RenNetwork.Mainnet]: renChainMainnetConfig,
    };
    public configMap = Catalog.configMap;

    public static assets = {};
    public assets = Catalog.assets;

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
            network: resolveEVMNetworkConfig(Catalog.configMap, network),
            provider,
            signer,
            config,
        });
    }
}
