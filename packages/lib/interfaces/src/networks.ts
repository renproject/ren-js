export enum RenNetwork {
    Mainnet = "mainnet",
    Testnet = "testnet",
    Devnet = "devnet",
    Localnet = "localnet",

    // Staging
    /**
     * @deprecated Replaced by Mainnet - will be removed in v3
     */
    MainnetVDot3 = "mainnet",

    /**
     * @deprecated Replaced by Testnet - will be removed in v3
     */
    TestnetVDot3 = "testnet",

    /**
     * @deprecated Replaced by Devnet - will be removed in v3
     */
    DevnetVDot3 = "devnet",
}

export interface RenNetworkDetails {
    name: string;
    lightnode: string;
    isTestnet: boolean;
}

const renMainnet: RenNetworkDetails = {
    name: RenNetwork.Mainnet,
    lightnode: "https://lightnode-mainnet.herokuapp.com",
    isTestnet: false,
};
const renTestnet: RenNetworkDetails = {
    name: RenNetwork.Testnet,
    lightnode: "https://lightnode-testnet.herokuapp.com",
    isTestnet: true,
};
const renDevnet: RenNetworkDetails = {
    name: RenNetwork.Devnet,
    lightnode: "https://lightnode-devnet.herokuapp.com/",
    isTestnet: true,
};
const renLocalnet: RenNetworkDetails = {
    name: RenNetwork.Localnet,
    lightnode: "http://localhost:5000",
    isTestnet: true,
};

export const getRenNetworkDetails = (
    renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
): RenNetworkDetails => {
    switch (renNetwork) {
        case RenNetwork.Mainnet:
        case RenNetwork.Mainnet as "mainnet":
        case "mainnet-v0.3":
            return renMainnet;
        case RenNetwork.Testnet:
        case RenNetwork.Testnet as "testnet":
        case "testnet-v0.3":
            return renTestnet;
        case RenNetwork.Devnet:
        case RenNetwork.Devnet as "devnet":
        case "devnet-v0.3":
            return renDevnet;
        case RenNetwork.Localnet:
        case RenNetwork.Localnet as "localnet":
            return renLocalnet;
        default:
            return renNetwork;
    }
};

export type RenNetworkString = "mainnet" | "testnet" | "devnet" | "localnet";

export const RenNetworks = [
    RenNetwork.Mainnet,
    RenNetwork.Testnet,
    RenNetwork.Devnet,
    RenNetwork.Localnet,
];
