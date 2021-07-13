import { LockChain, MintChain } from "@renproject/interfaces";
import { resolveV2Contract } from "@renproject/rpc/build/main/v2";
import { expect } from "earljs";

import { parseV1Selector } from "../src/renVMUtils";

describe("renVMUtils", () => {
    context("parseV1Selector", () => {
        it("should split up a contract's chains and asset", () => {
            expect(parseV1Selector("BTC0Btc2Eth")).toEqual({
                asset: "BTC",
                from: "Btc",
                to: "Eth",
            });

            expect(parseV1Selector("BTC0Eth2Btc")).toEqual({
                asset: "BTC",
                from: "Eth",
                to: "Btc",
            });

            // 4-character ticker:
            expect(parseV1Selector("DOGE0Eth2Doge")).toEqual({
                asset: "DOGE",
                from: "Eth",
                to: "Doge",
            });

            // Throw an error for an invalid contract:
            expect(() => parseV1Selector("bad contract")).toThrow(
                `Invalid Ren Contract "bad contract"`,
            );
        });
    });

    context("resolveInToken", () => {
        it("converts transfer parameters to the RenVM contract name", () => {
            expect(
                resolveV2Contract({
                    asset: "BTC",
                    from: { name: "Btc" } as unknown as LockChain,
                    to: { name: "Eth" } as unknown as MintChain,
                }),
            ).toEqual("BTC/fromBtcToEth");
        });
    });

    context("resolveOutToken", () => {
        it("converts transfer parameters to the RenVM contract name", () => {
            expect(
                resolveV2Contract({
                    asset: "BTC",
                    from: { name: "Eth" } as unknown as MintChain,
                    to: { name: "Btc" } as unknown as LockChain,
                }),
            ).toEqual("BTC/fromEthToBtc");
        });
    });
});
