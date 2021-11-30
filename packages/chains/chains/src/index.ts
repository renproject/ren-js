export * from "@renproject/chains-bitcoin";
export * from "@renproject/chains-ethereum";
export * from "@renproject/chains-filecoin";
export * from "@renproject/chains-terra";
// export * from "@renproject/chains-solana";

import {
    Bitcoin,
    BitcoinCash,
    DigiByte,
    Dogecoin,
    Zcash,
} from "@renproject/chains-bitcoin";
import {
    Arbitrum,
    Avalanche,
    BinanceSmartChain,
    Ethereum,
    Fantom,
    Goerli,
    Polygon,
} from "@renproject/chains-ethereum";
import { Filecoin } from "@renproject/chains-filecoin";
import { Terra } from "@renproject/chains-terra";

// import { Solana } from "@renproject/chains-solana";

export const chains = {
    Arbitrum,
    Avalanche,
    BinanceSmartChain,
    Bitcoin,
    BitcoinCash,
    DigiByte,
    Dogecoin,
    Ethereum,
    Fantom,
    Filecoin,
    Goerli,
    Polygon,
    // Solana,
    Terra,
    Zcash,
};

export enum Asset {
    ArbETH = "ArbETH",
    AVAX = "AVAX",
    BADGER = "BADGER",
    BCH = "BCH",
    BNB = "BNB",
    BTC = "BTC",
    BUSD = "BUSD",
    CRV = "CRV",
    DAI = "DAI",
    DGB = "DGB",
    DOGE = "DOGE",
    ETH = "ETH",
    EURT = "EURT",
    FIL = "FIL",
    FTM = "FTM",
    FTT = "FTT",
    gETH = "gETH",
    KNC = "KNC",
    LINK = "LINK",
    LUNA = "LUNA",
    MATIC = "MATIC",
    MIM = "MIM",
    REN = "REN",
    ROOK = "ROOK",
    SUSHI = "SUSHI",
    UNI = "UNI",
    USDC = "USDC",
    USDT = "USDT",
    ZEC = "ZEC",
}

export const assets = Object.values(chains).reduce<string[]>(
    (acc, chain) => acc.concat(Object.values(chain.assets)),
    [],
);

/* eslint-disable @typescript-eslint/no-shadow */
export enum Chain {
    Arbitrum = "Arbitrum",
    Avalanche = "Avalanche",
    BinanceSmartChain = "BinanceSmartChain",
    Bitcoin = "Bitcoin",
    BitcoinCash = "BitcoinCash",
    DigiByte = "DigiByte",
    Dogecoin = "Dogecoin",
    Ethereum = "Ethereum",
    Fantom = "Fantom",
    Filecoin = "Filecoin",
    Goerli = "Goerli",
    Polygon = "Polygon",
    // Solana = "Solana",
    Terra = "Terra",
    Zcash = "Zcash",
}

export default chains;
