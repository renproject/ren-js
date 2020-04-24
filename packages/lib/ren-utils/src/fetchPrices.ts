import Axios from "axios";
import BigNumber from "bignumber.js";
import { Map, OrderedMap } from "immutable";

const tokenDecimals = (token: string): number => {
    switch (token) {
        case "BTC":
            return 8;
        case "ZEC":
            return 8;
        case "BCH":
            return 8;
        case "DAI":
            return 18;
        case "ETH":
            return 18;
        case "REN":
            return 18;
        default:
            throw new Error(`Unknown token ${token}`);
    }
};

const coinGeckoID = (token: string): string => {
    switch (token) {
        case "BTC":
            return "bitcoin";
        case "ZEC":
            return "zcash";
        case "BCH":
            return "bitcoin-cash";
        case "DAI":
            return "dai";
        case "ETH":
            return "ethereum";
        case "REN":
            return "republic-protocol";
        default:
            throw new Error(`Unknown token ${token}`);
    }
};

const coinGeckoURL = `https://api.coingecko.com/api/v3`;
const coinGeckoParams = `localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

enum Currency {
    USD = "usd",
}

export const getTokenPrices = (tokens: string[]): Promise<TokenPrices> =>
    tokens.map((token) => ({
        token,
        responsePromise: Axios.get(
            `${coinGeckoURL}/coins/${coinGeckoID(token)}?${coinGeckoParams}`
        )
    }))
        .reduce(async (pricesPromise, { token, responsePromise }) => {
            let prices = await pricesPromise;
            try {
                const price = Map<Currency, number>((await responsePromise).data.market_data.current_price);
                prices = prices.set(token, price);
            } catch (error) {
                console.error(error);
            }
            return prices;
        }, Promise.resolve(OrderedMap<string, Map<Currency, number>>()));

export type TokenPrices = OrderedMap<string, Map<Currency, number>>;

export const normalizeValue = (prices: TokenPrices, token: string, value: string | number | BigNumber): BigNumber => {
    const shiftedValue = new BigNumber(value).div(new BigNumber(10).exponentiatedBy(tokenDecimals(token)));
    const timesPrice = shiftedValue.times(prices.get(token, Map<Currency, number>()).get(Currency.USD, new BigNumber(0)));
    return timesPrice;
};
