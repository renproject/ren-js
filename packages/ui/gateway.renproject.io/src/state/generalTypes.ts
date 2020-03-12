import { Chain } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { NetworkDetails } from "@renproject/utils/build/main/types/networks";
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
    .set(Token.BTC, { symbol: Token.BTC, name: "Bitcoin", decimals: 8, priority: 200, chain: RenJS.Chains.Bitcoin, validator: btcValidator })
    // .set(Token.ETH, { symbol: Token.ETH, name: "Ethereum", decimals: 18, priority: 1024, chain: RenJS.Chains.Ethereum, validator: ethValidator })
    .set(Token.ZEC, { symbol: Token.ZEC, name: "Zcash", decimals: 8, priority: 201, chain: RenJS.Chains.Zcash, validator: zecValidator })
    .set(Token.BCH, { symbol: Token.BCH, name: "BCash", decimals: 8, priority: 202, chain: RenJS.Chains.BitcoinCash, validator: bchValidator })
    ;

interface TokenDetails {
    name: string;
    symbol: Token;
    decimals: number;
    priority: number;
    chain: Chain.Ethereum | Chain.Bitcoin | Chain.Zcash | Chain.BitcoinCash;
    validator: (address: string, isTestnet: boolean) => boolean;
}

/// Initialize Web3 and contracts
export const getERC20 = (web3: Web3, networkDetails: NetworkDetails, tokenAddress: string): ERC20Detailed =>
    new (web3.eth.Contract)(networkDetails.contracts.addresses.erc.ERC20.abi, tokenAddress);
