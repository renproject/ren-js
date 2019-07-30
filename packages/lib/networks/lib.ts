import devnetJSON from "./src/networks/devnet";
import ganacheJSON from "./src/networks/ganache";
import localnetJSON from "./src/networks/localnet";
import mainnetJSON from "./src/networks/mainnet";
import testnetJSON from "./src/networks/testnet";

export const mainnet = mainnetJSON;
export const testnet = testnetJSON;
export const devnet = devnetJSON;
export const localnet = localnetJSON;
export const ganache = ganacheJSON;

export enum RenNetwork {
    Mainnet = "mainnet",
    Testnet = "testnet",
    Devnet = "devnet",
    Localnet = "localnet",
}

export const RenNetworks = {
    [RenNetwork.Mainnet]: mainnet,
    [RenNetwork.Testnet]: testnet,
    [RenNetwork.Devnet]: devnet,
    [RenNetwork.Localnet]: localnet,
}

export type RenNetworkDetails = typeof mainnet | typeof testnet | typeof devnet | typeof localnet;
