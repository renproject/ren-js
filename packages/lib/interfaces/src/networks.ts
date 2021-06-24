export enum RenNetwork {
    Mainnet = "mainnet",
    Testnet = "testnet",
    Devnet = "devnet",
    Localnet = "localnet",

    // Staging
    /**
     * @deprecated Replaced by Mainnet
     */
    MainnetVDot3 = "mainnet",

    /**
     * @deprecated Replaced by Testnet
     */
    TestnetVDot3 = "testnet",

    /**
     * @deprecated Replaced by Devnet
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
const renMainnetVDot3 = renMainnet;
const renTestnetVDot3 = renTestnet;
const renDevnetVDot3 = renDevnet;

export const getRenNetworkDetails = (
    renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
): RenNetworkDetails => {
    switch (renNetwork) {
        case RenNetwork.Mainnet:
        case RenNetwork.Mainnet as "mainnet":
            return renMainnet;
        case RenNetwork.Testnet:
        case RenNetwork.Testnet as "testnet":
            return renTestnet;
        case RenNetwork.MainnetVDot3:
        case "mainnet-v0.3":
            return renMainnetVDot3;
        case RenNetwork.TestnetVDot3:
        case "testnet-v0.3":
            return renTestnetVDot3;
        case RenNetwork.DevnetVDot3:
        case "devnet-v0.3":
            return renDevnetVDot3;
        case RenNetwork.Localnet:
        case RenNetwork.Localnet as "localnet":
            return renLocalnet;
        default:
            return renNetwork;
    }
};

export type RenNetworkString =
    | "mainnet"
    | "testnet"
    | "mainnet-v0.3"
    | "testnet-v0.3"
    | "devnet-v0.3"
    | "localnet";

export const RenNetworks = [
    RenNetwork.Mainnet,
    RenNetwork.Testnet,
    RenNetwork.Devnet,
    RenNetwork.Localnet,
];
