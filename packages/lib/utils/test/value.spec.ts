import { expect } from "earljs";

import { value } from "../src/value";

describe("value", () => {
    it("should be able to pass in different networks", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any

        // BTC
        expect(
            value("0.0001", "btc")
                .sats()
                .toFixed(),
        ).toEqual("10000");
        expect(
            value("0.0001", "btc")
                .btc()
                .toFixed(),
        ).toEqual("0.0001");
        expect(
            value("0.0001", "btc")
                ._smallest()
                .toFixed(),
        ).toEqual("10000");
        expect(
            value("0.0001", "btc")
                ._readable()
                .toFixed(),
        ).toEqual("0.0001");

        // BCH
        expect(
            value("0.0001", "bch")
                .sats()
                .toFixed(),
        ).toEqual("10000");
        expect(
            value("0.0001", "bch")
                .bch()
                .toFixed(),
        ).toEqual("0.0001");
        expect(
            value("0.0001", "bch")
                ._smallest()
                .toFixed(),
        ).toEqual("10000");
        expect(
            value("0.0001", "bch")
                ._readable()
                .toFixed(),
        ).toEqual("0.0001");

        // From sats
        expect(
            value("10000", "sats")
                .btc()
                .toFixed(),
        ).toEqual("0.0001");
        expect(
            value("10000", "sats")
                .bch()
                .toFixed(),
        ).toEqual("0.0001");
        expect(
            value("10000", "sats")
                .sats()
                .toFixed(),
        ).toEqual("10000");
        expect(
            value("10000", "sats")
                ._smallest()
                .toFixed(),
        ).toEqual("10000");
        expect(
            value("10000", "sats")
                ._readable()
                .toFixed(),
        ).toEqual("0.0001");

        // ZEC
        expect(
            value("0.0001", "zec")
                .zats()
                .toFixed(),
        ).toEqual("10000");
        expect(
            value("0.0001", "zec")
                .zec()
                .toFixed(),
        ).toEqual("0.0001");
        expect(
            value("0.0001", "zec")
                ._smallest()
                .toFixed(),
        ).toEqual("10000");
        expect(
            value("0.0001", "zec")
                ._readable()
                .toFixed(),
        ).toEqual("0.0001");

        // From eth
        expect(
            value("10000", "wei")
                .eth()
                .toFixed(),
        ).toEqual("0.00000000000001");
        expect(
            value("0.00000000000001", "eth")
                .wei()
                .toFixed(),
        ).toEqual("10000");
        expect(
            value("10000", "wei")
                ._readable()
                .toFixed(),
        ).toEqual("0.00000000000001");
        expect(
            value("0.00000000000001", "eth")
                ._smallest()
                .toFixed(),
        ).toEqual("10000");
        expect(
            value("1", "wei")
                .wei()
                .toFixed(),
        ).toEqual("1");
        expect(
            value("0.1", "eth")
                .eth()
                .toFixed(),
        ).toEqual("0.1");
        // Test unit resolution
        expect(
            value("0.1", "eth")
                .to("ethereum" as "eth")
                .toFixed(),
        ).toEqual("0.1");
        expect(
            value("0.1", "eth")
                .to("eth")
                .toFixed(),
        ).toEqual("0.1");

        // Invalid unit
        expect(() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value("0.0001", "fake" as any)
                ._readable()
                .toFixed(),
        ).toThrow(`Unknown unit "fake"`);
    });
});
