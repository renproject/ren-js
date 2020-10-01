import { RenNetwork } from "@renproject/interfaces";
import { renBscTestnet } from "@renproject/networks";
import { Callable } from "@renproject/utils";
import Web3 from "web3";
import { provider } from "web3-providers";

import { EthereumClass } from "./ethereum";

const getRenBscMainnet = () => {
    throw new Error(`BSC mainnet is not supported yet.`);
};

export class BinanceSmartChainClass extends EthereumClass {
    public name = "BinanceSmartChain";

    constructor(
        web3Provider: provider | "mainnet" | "testnet" = "mainnet",
        network: "mainnet" | "testnet" = "mainnet"
    ) {
        // To be compatible with the Ethereum chain class, the first parameter
        // is a web3Provider and the second the RenVM network. However,
        super(
            web3Provider === "mainnet" || web3Provider === "testnet"
                ? new Web3(
                      (web3Provider === "testnet"
                          ? renBscTestnet
                          : getRenBscMainnet()
                      ).infura
                  ).currentProvider
                : web3Provider,
            web3Provider === "testnet" || network === "testnet"
                ? RenNetwork.Testnet
                : undefined,
            web3Provider === "testnet" || network === "testnet"
                ? renBscTestnet
                : undefined
        );
    }
}

export type BinanceSmartChain = BinanceSmartChainClass;
export const BinanceSmartChain = Callable(BinanceSmartChainClass);
