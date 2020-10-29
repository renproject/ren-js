import { Logger } from "@renproject/interfaces";
import Axios from "axios";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";

import { SECONDS } from "./common";

type PriceFeed = (token: string) => Promise<number>;

const tokenDecimals = (token: string): number => {
    switch (token) {
        case "BTC":
            return 8;
        case "ZEC":
            return 8;
        case "BCH":
            return 8;
        default:
            throw new Error(`Unknown token ${token}`);
    }
};

// CoinGecko price feed
const coinGeckoURL = `https://api.coingecko.com/api/v3`;
const coinGeckoID = (token: string): string => {
    switch (token) {
        case "BTC":
            return "bitcoin";
        case "ZEC":
            return "zcash";
        case "BCH":
            return "bitcoin-cash";
        default:
            throw new Error(`Unknown token ${token}`);
    }
};
const coinGeckoParams = `localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
const getCoinGeckoPrice: PriceFeed = async (token: string) =>
    Axios
        // Fetch API endpoint with 5 second timeout.
        .get<{ market_data: { current_price: { usd: number } } }>(
            `${coinGeckoURL}/coins/${coinGeckoID(token)}?${coinGeckoParams}`,
            { timeout: 5 * SECONDS },
        )
        .then((response) => response.data.market_data.current_price.usd || 0);

// Coinbase price feed
const coinbaseURL = (token: string) =>
    `https://api.coinbase.com/v2/prices/${token.toUpperCase()}-USD/buy`;
const getCoinbasePrice: PriceFeed = async (token: string) =>
    Axios
        // Fetch API endpoint with 5 second timeout.
        .get<{ data: { base: string; currency: "USD"; amount: string } }>(
            coinbaseURL(token),
            { timeout: 5 * SECONDS },
        )
        .then((response) => parseInt(response.data.data.amount, 10) || 0);

export const getTokenPrices = async (
    tokens: string[],
    logger?: Logger,
): Promise<TokenPrices> => {
    try {
        return await tokens
            .map((token) => ({
                token,
                priceFeeds: [
                    getCoinGeckoPrice(token).catch(() => undefined),
                    getCoinbasePrice(token).catch(() => undefined),
                    // getCoinMarketCapPrice(token),
                ],
            }))
            .reduce(async (pricesPromise, { token, priceFeeds }) => {
                const prices = await pricesPromise.catch(() =>
                    OrderedMap<string, number>(),
                );
                const returnedAPIs = [];
                for (const priceFeed of priceFeeds) {
                    try {
                        const result = await priceFeed;
                        if (result !== undefined) {
                            returnedAPIs.push(result);
                        }
                    } catch (error) {
                        if (logger) logger.error(error);
                    }
                }

                return prices.set(
                    token,
                    returnedAPIs.length
                        ? returnedAPIs.reduce((sum, price) => sum + price, 0) /
                              returnedAPIs.length
                        : 0,
                );
            }, Promise.resolve(OrderedMap<string, number>()));
    } catch (error) {
        if (logger) logger.error(error);
        return OrderedMap<string, number>();
    }
};

export type TokenPrices = OrderedMap<string, number>;

export const normalizeValue = (
    prices: TokenPrices,
    token: string,
    value: string | number | BigNumber,
): BigNumber => {
    try {
        const shiftedValue = new BigNumber(value).div(
            new BigNumber(10).exponentiatedBy(tokenDecimals(token)),
        );
        const timesPrice = shiftedValue.times(prices.get(token, 0));
        return timesPrice;
    } catch (error) {
        // Ignore error
        return new BigNumber(0);
    }
};
