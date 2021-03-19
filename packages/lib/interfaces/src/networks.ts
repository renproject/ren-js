export enum RenNetwork {
    Mainnet = "mainnet",
    Testnet = "testnet",

    // Staging
    MainnetVDot3 = "mainnet-v0.3",
    TestnetVDot3 = "testnet-v0.3",
    DevnetVDot3 = "devnet-v0.3",
    DevnetVDot4 = "devnet-v0.4",
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
const renMainnetVDot3: RenNetworkDetails = {
    name: RenNetwork.MainnetVDot3,
    lightnode: "https://lightnode-new-mainnet.herokuapp.com/",
    isTestnet: false,
};
const renTestnetVDot3: RenNetworkDetails = {
    name: RenNetwork.TestnetVDot3,
    lightnode: "https://lightnode-new-testnet.herokuapp.com/",
    isTestnet: true,
};
const renDevnetVDot3: RenNetworkDetails = {
    name: RenNetwork.DevnetVDot3,
    lightnode: "https://lightnode-devnet.herokuapp.com/",
    isTestnet: true,
};

const renDevnetVDot4: RenNetworkDetails = {
    name: RenNetwork.DevnetVDot4,
    lightnode: "https://lightnode-devnet.herokuapp.com/",
    isTestnet: true,
};

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
        case RenNetwork.MainnetVDot3 as "mainnet-v0.3":
            return renMainnetVDot3;
        case RenNetwork.TestnetVDot3:
        case RenNetwork.TestnetVDot3 as "testnet-v0.3":
            return renTestnetVDot3;
        case RenNetwork.DevnetVDot3:
        case RenNetwork.DevnetVDot3 as "devnet-v0.3":
            return renDevnetVDot3;
        case RenNetwork.DevnetVDot4:
        case RenNetwork.DevnetVDot4 as "devnet-v0.4":
            return renDevnetVDot4;
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
    | "devnet-v0.4";

export const RenNetworks = [
    RenNetwork.Mainnet,
    RenNetwork.Testnet,
    RenNetwork.MainnetVDot3,
    RenNetwork.TestnetVDot3,
    RenNetwork.DevnetVDot3,
    RenNetwork.DevnetVDot4,
];
