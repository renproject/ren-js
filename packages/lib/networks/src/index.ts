import chaosnetJSON from "./networks/chaosnet";
import devnetJSON from "./networks/devnet";
import localnetJSON from "./networks/localnet";
import mainnetJSON from "./networks/mainnet";
import testnetJSON from "./networks/testnet";

export const renMainnet = mainnetJSON;
export const renChaosnet = chaosnetJSON;
export const renTestnet = testnetJSON;
export const renDevnet = devnetJSON;
export const renLocalnet = localnetJSON;

export enum RenNetwork {
    Mainnet = "mainnet",
    Chaosnet = "chaosnet",
    Testnet = "testnet",
    Devnet = "devnet",
    Localnet = "localnet",
}

export const RenNetworks = {
    [RenNetwork.Mainnet]: renMainnet,
    [RenNetwork.Chaosnet]: renChaosnet,
    [RenNetwork.Testnet]: renTestnet,
    [RenNetwork.Devnet]: renDevnet,
    [RenNetwork.Localnet]: renLocalnet,
};

export type RenNetworkDetails = typeof renMainnet | typeof renChaosnet | typeof renTestnet | typeof renDevnet | typeof renLocalnet;
