import { expect } from "chai";

import { Solana } from "../src";

describe("Utils", () => {
    it("validateTransaction", () => {
        const solana = new Solana({
            network: "testnet",
            provider: {} as any,
        });

        expect(
            solana.validateTransaction({
                txidFormatted:
                    "3mabcf8u7eduVN3GfM8nyGwJ3g3GqApqbGq8m2CtoakgeEVHsw1ZgqSL7KWCRaEdK9rcHUwWNfpkGAb17ewC6XwV",
            }),
        ).to.be.true;

        expect(
            solana.validateTransaction({
                txidFormatted:
                    "3mabcf8u7eduVN3GfM8nyGwJ3g3GqApqbGq8m2CtoakgeEVHsw1ZgqSL7KWCRaEdK9rcHUwWNfpkGAb17ewC6XwV",
                txid: "ino6crZYCRm5Lm6kMlt9hZo68stwCZywdXZdsttSXoB_tDfB7cB4fDdeBX-xodXoFwZl3MfKpwDj0_tKDogfCA",
                txindex: "0",
            }),
        ).to.be.true;
    });
});
