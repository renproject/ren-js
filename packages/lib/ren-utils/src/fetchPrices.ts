import Axios from "axios";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";

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

type PriceFeed = (token: string) => Promise<number>;

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
const coinGeckoParams = `localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
const getCoinGeckoPrice: PriceFeed = (token: string) =>
    Axios
        .get<{ market_data: { current_price: { usd: number } } }>(`${coinGeckoURL}/coins/${coinGeckoID(token)}?${coinGeckoParams}`)
        .then(response => response.data.market_data.current_price.usd || 0);

// Coinbase price feed
const coinbaseURL = (token: string) => `https://api.coinbase.com/v2/prices/${token.toUpperCase()}-USD/buy`;
const getCoinbasePrice: PriceFeed = (token: string) =>
    Axios
        .get<{ "data": { "base": string, "currency": "USD", "amount": string } }>(coinbaseURL(token))
        .then(response => parseInt(response.data.data.amount, 10) || 0);


// const coinMarketCapID = (token: string): number => {
//     /*
//     In order to fetch the code of a currency, use:

//     ```js
//     let x;
//     Axios({
//         method: "GET",
//         url: "https://pro-api.coinmarketcap.com/v1/cryptocurrency/map",
//         params: {
//             "symbol": "BTC,ZEC,BCH"
//         },
//         headers: {
//             [`X-CMC` + `_PRO_API_KEY`]: "..."
//         },
//     }).then(r => { x = r.data.data; }).catch(console.error);
//     console.debug(x.filter(row => ["BTC", "ZEC", BCH"].includes(row.symbol)))
//     ```
//     */

//     switch (token) {
//         case "BTC":
//             return 1;
//         case "ZEC":
//             return 1437;
//         case "BCH":
//             return 1831;
//         default:
//             throw new Error(`Unknown token ${token}`);
//     }
// };
// const getCoinMarketCapPrice: PriceFeed = (token: string) =>
//     Axios.request({
//         url: "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest",
//         method: "GET",
//         params: {
//             "start": `${coinMarketCapID(token)}`,
//             "limit": "1",
//             // "convert": "USD,BTC"
//         },
//         headers: {
//             // Free-tier CMC API key.
//             [`X-CMC` + `_PRO_API_KEY`]: `${24874700}-${1064}-447d-9daa-3fd514863f67`
//         },
//     }).then((response: { data: { data: Array<{ symbol: string, quote: { USD: { price: number } } }> } }) => { return response.data.data.filter(x => x.symbol === token)[0].quote.USD.price; });

export const getTokenPrices = async (tokens: string[]): Promise<TokenPrices> => {
    try {
        return await tokens.map((token) => ({
            token,
            priceFeeds: [
                getCoinGeckoPrice(token),
                getCoinbasePrice(token),
                // getCoinMarketCapPrice(token),
            ],
        }))
            .reduce(async (pricesPromise, { token, priceFeeds }) => {
                const prices = await pricesPromise;
                const returnedAPIs = [];
                for (const priceFeed of priceFeeds) {
                    try {
                        returnedAPIs.push(await priceFeed);
                    } catch (error) {
                        // tslint:disable-next-line: no-console
                        console.error(error);
                    }
                }

                return prices.set(token, returnedAPIs.length ?
                    returnedAPIs.reduce((sum, price) => sum + price, 0) / returnedAPIs.length :
                    0
                );
            }, Promise.resolve(OrderedMap<string, number>()));
    } catch (error) {
        console.error(error);
        return OrderedMap<string, number>();
    }
};

export type TokenPrices = OrderedMap<string, number>;

export const normalizeValue = (prices: TokenPrices, token: string, value: string | number | BigNumber): BigNumber => {
    const shiftedValue = new BigNumber(value).div(new BigNumber(10).exponentiatedBy(tokenDecimals(token)));
    const timesPrice = shiftedValue.times(prices.get(token, 0));
    return timesPrice;
};
