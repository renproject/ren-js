import { LockChain, MintChain } from "@renproject/interfaces";
import { expect } from "earljs";

import {
    parseRenContract,
    resolveInToken,
    resolveOutToken,
} from "../src/renVMUtils";

describe("renVMUtils", () => {
    context("parseRenContract", () => {
        it("should split up a contract's chains and asset", () => {
            expect(parseRenContract("BTC0Btc2Eth")).toEqual({
                asset: "BTC",
                from: "Btc",
                to: "Eth"
            });

            expect(parseRenContract("BTC0Eth2Btc")).toEqual({
                asset: "BTC",
                from: "Eth",
                to: "Btc"
            });

            // 4-character ticker:
            expect(parseRenContract("DOGE0Eth2Doge")).toEqual({
                asset: "DOGE",
                from: "Eth",
                to: "Doge"
            });

            // Throw an error for an invalid contract:
            expect(() => parseRenContract("bad contract")).toThrow(
                new Error(`Invalid Ren Contract "bad contract"`)
            );
        });
    });

    context("resolveInToken", () => {
        it("converts transfer parameters to the RenVM contract name", () => {
            expect(
                resolveInToken({
                    asset: "BTC",
                    from: ({ name: "Btc" } as unknown) as LockChain,
                    to: ({ name: "Eth" } as unknown) as MintChain
                })
            ).toEqual("BTC0Btc2Eth");
        });
    });

    context("resolveOutToken", () => {
        it("converts transfer parameters to the RenVM contract name", () => {
            expect(
                resolveOutToken({
                    asset: "BTC",
                    from: ({ name: "Eth" } as unknown) as MintChain,
                    to: ({ name: "Btc" } as unknown) as LockChain
                })
            ).toEqual("BTC0Eth2Btc");
        });
    });
});
