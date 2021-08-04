import {
    getRenNetworkDetails,
    Logger,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import { NetworkInput } from "./base";
import { EthAddress, EthProvider, EthTransaction } from "./types";

import { EthereumClass } from "./ethereum";
import { EthereumConfig, StandardExplorer } from "./networks";
import { addressIsValid, transactionIsValid } from "./utils";

export const renGoerli: EthereumConfig = {
    name: "Görli Testnet",
    chain: "goerliTestnet",
    isTestnet: true,
    chainLabel: "Görli Testnet",
    networkID: 6284,
    addresses: {
        GatewayRegistry: "0xD881213F5ABF783d93220e6bD3Cc21706A8dc1fC",
        BasicAdapter: "0xD087b0540e172553c12DEEeCDEf3dFD21Ec02066",
    },

    publicProvider: ({ infura }: { infura?: string } = {}) =>
        `https://goerli.infura.io/v3/${infura || ""}`,
    explorer: StandardExplorer("https://goerli.etherscan.io"),

    /** @deprecated Renamed to publicProvider. Will be removed in 3.0.0. */
    infura: "https://goerli.infura.io",
    /** @deprecated Renamed to explorer. Will be removed in 3.0.0. */
    etherscan: "https://goerli.etherscan.io",
};

export const GoerliConfigMap = {
    [RenNetwork.Testnet]: renGoerli,
};

const resolveGoerliNetwork = (
    renNetwork?:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | EthereumConfig,
) => {
    if (!renNetwork) {
        return renGoerli;
    }
    if ((renNetwork as EthereumConfig).addresses) {
        return renNetwork as EthereumConfig;
    } else {
        const details = getRenNetworkDetails(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            renNetwork as RenNetwork | RenNetworkString | RenNetworkDetails,
        );
        if (!details.isTestnet) {
            throw new Error(`Goerli not supported on mainnet.`);
        }
        return renGoerli;
    }
};

export class GoerliClass extends EthereumClass {
    public static chain = "Goerli";
    public chain = GoerliClass.chain;
    public name = GoerliClass.chain;
    public legacyName = undefined;
    // public logRequestLimit = 1000;

    public static configMap = GoerliConfigMap;
    public configMap = GoerliConfigMap;

    public static utils = {
        resolveChainNetwork: resolveGoerliNetwork,
        addressIsValid,
        transactionIsValid,
        addressExplorerLink: (
            address: EthAddress,
            network?: NetworkInput,
        ): string =>
            `${
                (Goerli.utils.resolveChainNetwork(network) || renGoerli)
                    .etherscan
            }/address/${address}`,

        transactionExplorerLink: (
            transaction: EthTransaction,
            network?: NetworkInput,
        ): string =>
            `${
                (Goerli.utils.resolveChainNetwork(network) || renGoerli)
                    .etherscan
            }/tx/${transaction || ""}`,
    };

    public utils = utilsWithChainNetwork(
        GoerliClass.utils,
        () => this.renNetworkDetails,
    );

    constructor(
        web3Provider: EthProvider,
        renNetwork:
            | RenNetwork
            | RenNetworkString
            | RenNetworkDetails
            | EthereumConfig,
        config: {
            logger?: Logger;
        } = {},
    ) {
        // To be compatible with the Ethereum chain class, the first parameter
        // is a web3Provider and the second the RenVM network.
        super(web3Provider, resolveGoerliNetwork(renNetwork), config);
    }

    initialize = (
        renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => {
        this.renNetworkDetails =
            this.renNetworkDetails ||
            GoerliConfigMap[getRenNetworkDetails(renNetwork).name];

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

export type Goerli = GoerliClass;
// @dev Removes any static fields, except `utils`.
export const Goerli = Callable(GoerliClass);
