import {
    getRenNetworkDetails,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import { NetworkInput } from "./base";
import { EthAddress, EthTransaction } from "./types";
import {
    ExternalProvider,
    JsonRpcFetchFunc,
    Web3Provider,
} from "@ethersproject/providers";

import { EthereumClass } from "./ethereum";
import { EthereumConfig, StandardExplorer } from "./networks";
import { addressIsValid, transactionIsValid } from "./utils";
import { Signer } from "ethers";

export const renArbitrumTestnet: EthereumConfig = {
    name: "Arbitrum Testnet",
    chain: "ArbitrumTestnet",
    isTestnet: true,
    chainLabel: "Arbitrum Testnet",
    networkID: 421611,
    addresses: {
        GatewayRegistry: "0x5eEBf6c199a9Db26dabF621fB8c43D58C62DF2bd",
        BasicAdapter: "0x1156663dFab56A9BAdd844e12eDD69eC96Dd0eFb",
    },

    publicProvider: () => `https://rinkeby.arbitrum.io/rpc`,
    explorer: StandardExplorer("https://rinkeby-explorer.arbitrum.io"),

    /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
    infura: "https://rinkeby.arbitrum.io/rpc",
    /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
    etherscan: "https://rinkeby-explorer.arbitrum.io",
};

export const renArbitrumMainnet: EthereumConfig = {
    name: "Arbitrum Mainnet",
    chain: "ArbitrumMainnet",
    isTestnet: false,
    chainLabel: "Arbitrum Mainnet",
    networkID: 42161,
    addresses: {
        GatewayRegistry: "",
        BasicAdapter: "",
    },

    publicProvider: () => `https://arb1.arbitrum.io/rpc`,
    explorer: StandardExplorer("https://explorer.arbitrum.io"),

    /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
    infura: "https://arb1.arbitrum.io/rpc",
    /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
    etherscan: "https://explorer.arbitrum.io",
};

export const ArbitrumConfigMap = {
    [RenNetwork.TestnetVDot3]: renArbitrumTestnet,
    [RenNetwork.MainnetVDot3]: renArbitrumMainnet,
};

const resolveArbitrumNetwork = (
    renNetwork?:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | EthereumConfig,
) => {
    if (!renNetwork) {
        return ArbitrumConfigMap[RenNetwork.MainnetVDot3];
    }
    if ((renNetwork as EthereumConfig).addresses) {
        return renNetwork as EthereumConfig;
    } else {
        const details = getRenNetworkDetails(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            renNetwork as RenNetwork | RenNetworkString | RenNetworkDetails,
        );
        return details.isTestnet ? renArbitrumTestnet : renArbitrumMainnet;
    }
};

export class ArbitrumClass extends EthereumClass {
    public static chain = "Arbitrum";
    public chain = ArbitrumClass.chain;
    public name = ArbitrumClass.chain;
    public legacyName = undefined;

    public static configMap = ArbitrumConfigMap;
    public configMap = ArbitrumConfigMap;

    public static utils = {
        resolveChainNetwork: resolveArbitrumNetwork,
        addressIsValid,
        transactionIsValid,
        addressExplorerLink: (
            address: EthAddress,
            network?: NetworkInput,
        ): string =>
            `${
                (
                    ArbitrumClass.utils.resolveChainNetwork(network) ||
                    renArbitrumMainnet
                ).etherscan
            }/address/${address}`,

        transactionExplorerLink: (
            transaction: EthTransaction,
            network?: NetworkInput,
        ): string =>
            `${
                (
                    Arbitrum.utils.resolveChainNetwork(network) ||
                    renArbitrumMainnet
                ).etherscan
            }/tx/${transaction || ""}`,
    };

    public utils = utilsWithChainNetwork(
        ArbitrumClass.utils,
        () => this.renNetworkDetails,
    );

    constructor(
        web3Provider:
            | ExternalProvider
            | JsonRpcFetchFunc
            | {
                  provider: Web3Provider;
                  signer: Signer;
              },
        renNetwork:
            | RenNetwork
            | RenNetworkString
            | RenNetworkDetails
            | EthereumConfig,
    ) {
        // To be compatible with the Ethereum chain class, the first parameter
        // is a web3Provider and the second the RenVM network.
        super(web3Provider, resolveArbitrumNetwork(renNetwork));
    }

    initialize = (
        renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => {
        this.renNetworkDetails =
            this.renNetworkDetails ||
            ArbitrumConfigMap[getRenNetworkDetails(renNetwork).name];

        if (!this.renNetworkDetails) {
            throw new Error(
                `Unable to set ${this.name} network for RenVM network ${
                    getRenNetworkDetails(renNetwork).name
                }. Please provide ${this.name} network details to ${
                    this.name
                } constructor.`,
            );
        }
        return this;
    };
}

export type Arbitrum = ArbitrumClass;
// @dev Removes any static fields, except `utils`.
export const Arbitrum = Callable(ArbitrumClass);
