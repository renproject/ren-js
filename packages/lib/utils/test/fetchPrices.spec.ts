import { LogLevel, SimpleLogger } from "@renproject/interfaces";
import { expect } from "earljs";

import {
    getTokenPrices,
    normalizeValue,
    TokenPrices,
} from "../src/fetchPrices";

describe("fetchPrices", () => {
    let prices: TokenPrices;

    context("getTokenPrices", () => {
        it("", async () => {
            // If prices is already defined, skip checking warned.
            let warned = prices !== undefined;
            const logger = new SimpleLogger(LogLevel.Error);
            logger.error = () => {
                warned = true;
            };
            prices =
                prices ||
                (await getTokenPrices(["BTC", "ZEC", "BCH", "FAKE"], logger));
            expect(warned).toEqual(true);
            expect(prices.get("BTC") > 1).toEqual(true);

            // await expect(getTokenPrices(["FAKE"])).toBeRejected();
        });
    });

    context("normalizeValue", () => {
        it("", async () => {
            prices = prices || (await getTokenPrices(["BTC", "ZEC", "BCH"]));
            expect(normalizeValue(prices, "BTC", 1e8).toNumber()).toEqual(
                prices.get("BTC"),
            );

            expect(normalizeValue(prices, "ZEC", 1e8).toNumber()).toEqual(
                prices.get("ZEC"),
            );

            expect(normalizeValue(prices, "BCH", 1e8).toNumber()).toEqual(
                prices.get("BCH"),
            );

            expect(normalizeValue(prices, "FAKE", 1e8).toNumber()).toEqual(0);
        });
    });
});
