import * as devnetJSON from "./public/networks/devnet.json";
import * as localnetJSON from "./public/networks/localnet.json";
import * as mainnetJSON from "./public/networks/mainnet.json";
import * as testnetJSON from "./public/networks/testnet.json";

export const mainnet = mainnetJSON;
export const testnet = testnetJSON;
export const devnet = devnetJSON;
export const localnet = localnetJSON;

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
