import { expect } from "earljs";

import * as Chains from "../src";

require("dotenv").config();

describe("@renproject/chains", () => {
    it("should export chains correctly", async () => {
        expect(Chains.Ethereum).not.toEqual(undefined);
        expect(Chains.Bitcoin).not.toEqual(undefined);
        expect(Chains.BitcoinCash).not.toEqual(undefined);
        expect(Chains.Zcash).not.toEqual(undefined);
        expect(Chains.BSC).not.toEqual(undefined);
    });
});
