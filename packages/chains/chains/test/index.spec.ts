import { expect } from "chai";

import * as Chains from "../src";

describe("@renproject/chains", () => {
    it("should export chains correctly", async () => {
        expect(Chains.Ethereum).not.to.equal(undefined);
        expect(Chains.Bitcoin).not.to.equal(undefined);
        expect(Chains.BitcoinCash).not.to.equal(undefined);
        expect(Chains.Zcash).not.to.equal(undefined);
        expect(Chains.BinanceSmartChain).not.to.equal(undefined);
        expect(Chains.Solana).not.to.equal(undefined);
    });
});
