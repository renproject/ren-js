import { renBscTestnet } from "@renproject/networks";
import { provider, RenNetwork } from "@renproject/interfaces";
import Web3 from "web3";

import { Callable } from "./class";
import { EthereumChain } from "./ethereum";

export class BinanceSmartChain extends EthereumChain {
    public name = "BinanceSmartChain";

    constructor(
        web3Provider: provider,
        network: "mainnet" | "testnet" = "mainnet"
    ) {
        super(
            web3Provider,
            network === "testnet" ? RenNetwork.Testnet : undefined,
            network === "testnet" ? renBscTestnet : undefined
        );
    }
}

export const BSC = Callable(BinanceSmartChain);
