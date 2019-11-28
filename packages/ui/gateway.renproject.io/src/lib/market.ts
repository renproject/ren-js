import { Currency } from "@renproject/react-components";
import { Map, OrderedMap } from "immutable";

import { Token, TokenPrices } from "../state/generalTypes";

const CoinGeckoIDs = Map<Token, string>()
    .set(Token.DAI, "dai")
    .set(Token.BTC, "bitcoin")
    .set(Token.BCH, "bitcoin-cash")
    .set(Token.ETH, "ethereum")
    .set(Token.ZEC, "zcash");

/**
 * Retrieves the current pricepoint for two currencies.
 * @param fstCode The first currency.
 * @param sndCode The second currency.
 * @returns An array containing the price with respect to the currencies, and the 24 hour percent change.
 */
const fetchDetails = async (geckoID: string) => {
    const url = `https://api.coingecko.com/api/v3/coins/${geckoID}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
    const response = await fetch(url);
    return response.json();
};

export const getTokenPricesInCurrencies = async (): Promise<TokenPrices> =>
    /*await*/ CoinGeckoIDs
        .map((coinGeckoID) => fetchDetails(coinGeckoID))
        .reduce(async (pricesPromise, detailsPromise, token) => {
            const data = await detailsPromise;
            const price = Map<Currency, number>(data.market_data.current_price);

            return (await pricesPromise).set(token, price);
        }, Promise.resolve(Map<Token, Map<Currency, number>>()));

export enum MarketPair {
    DAI_BTC = "DAI/BTC",
    DAI_ZEC = "DAI/ZEC",
    DAI_BCH = "DAI/BCH",
    // ZEC_BTC = "ZEC/BTC",
}

interface MarketDetails {
    symbol: MarketPair;
    quote: Token;
    base: Token;
}

const MarketPairs = OrderedMap<MarketPair, MarketDetails>()
    // BTC pairs
    .set(MarketPair.DAI_BTC, { symbol: MarketPair.DAI_BTC, quote: Token.BTC, base: Token.DAI })
    .set(MarketPair.DAI_ZEC, { symbol: MarketPair.DAI_ZEC, quote: Token.ZEC, base: Token.DAI })
    .set(MarketPair.DAI_BCH, { symbol: MarketPair.DAI_BCH, quote: Token.BCH, base: Token.DAI })
    // .set(MarketPair.ZEC_BTC, { symbol: MarketPair.ZEC_BTC, quote: Token.BTC, base: Token.ZEC })
    ;

export const getMarket = (left: Token, right: Token): MarketPair | undefined => {
    return (
        MarketPairs.findKey((marketDetails: MarketDetails) => marketDetails.base === left && marketDetails.quote === right) ||
        MarketPairs.findKey((marketDetails: MarketDetails) => marketDetails.base === right && marketDetails.quote === left) ||
        undefined
    );
};
