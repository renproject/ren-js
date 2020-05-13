import { RenNetworkDetails } from "@renproject/contracts";
import { Chain } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { isMainnetAddress, isTestnetAddress } from "bchaddrjs";
import { Map } from "immutable";
import { validate } from "wallet-address-validator";
import Web3 from "web3";

import { ERC20Detailed } from "../lib/contracts/ERC20Detailed";

export enum Token {
    BTC = "BTC",
    ETH = "ETH",
    ZEC = "ZEC",
    BCH = "BCH",
}

// const ethValidator = (address: string, isTestnet: boolean) => validate(address, "eth", isTestnet ? "testnet" : "prod");
const btcValidator = (address: string, isTestnet: boolean) => validate(address, "btc", isTestnet ? "testnet" : "prod");
const zecValidator = (address: string, isTestnet: boolean) => validate(address, "zec", isTestnet ? "testnet" : "prod");
const bchValidator = (address: string, isTestnet: boolean) => {
    try {
        return isTestnet ? isTestnetAddress(address) : isMainnetAddress(address);
    } catch (error) {
        return false;
    }
};

export const Tokens = Map<Token, TokenDetails>()
    .set(Token.BTC, { name: "Bitcoin", chain: RenJS.Chains.Bitcoin, validator: btcValidator })
    .set(Token.ZEC, { name: "Zcash", chain: RenJS.Chains.Zcash, validator: zecValidator })
    .set(Token.BCH, { name: "BitcoinCash", chain: RenJS.Chains.BitcoinCash, validator: bchValidator })
    ;

interface TokenDetails {
    name: string;
    chain: Chain.Ethereum | Chain.Bitcoin | Chain.Zcash | Chain.BitcoinCash;
    validator: (address: string, isTestnet: boolean) => boolean;
}

/// Initialize Web3 and contracts
export const getERC20 = (web3: Web3, networkDetails: RenNetworkDetails, tokenAddress: string): ERC20Detailed =>
    new (web3.eth.Contract)(networkDetails.addresses.erc.ERC20.abi, tokenAddress);
