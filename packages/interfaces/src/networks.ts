export enum RenNetwork {
    Mainnet = "mainnet",
    Testnet = "testnet",
    Devnet = "devnet",
}

export type RenNetworkString = "mainnet" | "testnet" | "devnet";

export const renRpcUrls = {
    [RenNetwork.Mainnet]: "https://lightnode-mainnet.herokuapp.com",
    [RenNetwork.Testnet]: "https://lightnode-testnet.herokuapp.com",
    [RenNetwork.Devnet]: "https://lightnode-devnet.herokuapp.com/",
};
