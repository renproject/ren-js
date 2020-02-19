import chaosnetJSON from "./src/networks/chaosnet";
import devnetJSON from "./src/networks/devnet";
import localnetJSON from "./src/networks/localnet";
import mainnetJSON from "./src/networks/mainnet";
import testnetJSON from "./src/networks/testnet";

export const mainnet = mainnetJSON;
export const chaosnet = chaosnetJSON;
export const testnet = testnetJSON;
export const devnet = devnetJSON;
export const localnet = localnetJSON;

export enum RenNetwork {
    Mainnet = "mainnet",
    Chaosnet = "chaosnet",
    Testnet = "testnet",
    Devnet = "devnet",
    Localnet = "localnet",
}

export const RenNetworks = {
    [RenNetwork.Mainnet]: mainnet,
    [RenNetwork.Chaosnet]: chaosnet,
    [RenNetwork.Testnet]: testnet,
    [RenNetwork.Devnet]: devnet,
    [RenNetwork.Localnet]: localnet,
};

export type RenNetworkDetails = typeof mainnet | typeof chaosnet | typeof testnet | typeof devnet | typeof localnet;
