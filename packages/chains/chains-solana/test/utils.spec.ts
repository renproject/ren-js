import { Connection } from "@solana/web3.js";
import { expect } from "chai";

import { Solana } from "../src";
import { signerFromMnemonic, signerFromPrivateKey } from "../src/utils";

describe("Utils", () => {
    it("validateTransaction", () => {
        const solana = new Solana({
            network: "testnet",
            provider: {} as unknown as Connection,
        });

        expect(
            solana.validateTransaction({
                txHash: "3mabcf8u7eduVN3GfM8nyGwJ3g3GqApqbGq8m2CtoakgeEVHsw1ZgqSL7KWCRaEdK9rcHUwWNfpkGAb17ewC6XwV",
            }),
        ).to.be.true;

        expect(
            solana.validateTransaction({
                txHash: "3mabcf8u7eduVN3GfM8nyGwJ3g3GqApqbGq8m2CtoakgeEVHsw1ZgqSL7KWCRaEdK9rcHUwWNfpkGAb17ewC6XwV",
                txid: "ino6crZYCRm5Lm6kMlt9hZo68stwCZywdXZdsttSXoB_tDfB7cB4fDdeBX-xodXoFwZl3MfKpwDj0_tKDogfCA",
                txindex: "0",
            }),
        ).to.be.true;
    });

    it("signerFromMnemonic", () => {
        // Test mnemonic - DO NOT USE.
        const mnemonic =
            "fiber quarter possible fluid fatal harvest layer harsh east neck jewel marine";

        const signer1 = signerFromMnemonic(mnemonic);
        expect(signer1.publicKey.toBase58()).to.equal(
            "GCQcNnHZ712nkkNeGFhHRj22qbps3tmvesSu2bhb3U4f",
        );

        const signer2 = signerFromMnemonic(mnemonic, "m/44'/501'/0'");
        expect(signer2.publicKey.toBase58()).to.equal(
            "8dMCt1MtKNaFrBJeb6Bp5FETSqQPqB4gGsAFqWpsNvoc",
        );
    });

    it("signerFromPrivateKey", () => {
        // Test private keys - DO NOT USE.

        // From hex.
        const signer1 = signerFromPrivateKey(
            "1cd9ae6e2b1ba34523096765bae7f0f95563254469934e97c3c282171748f57ae1cb637c9b36af38f20615450a15d45278825cad9dc2c59e2a2e4e77fad57210",
        );
        expect(signer1.publicKey.toBase58()).to.equal(
            "GCQcNnHZ712nkkNeGFhHRj22qbps3tmvesSu2bhb3U4f",
        );

        // From base58.
        const signer2 = signerFromPrivateKey(
            "aTPc1419CrWBNz95E5YNpaR6Tq1D1Jnq2XiyoGy9TdyrFSmYJRmZ8DBcETrWWhJg6s5g9Q6Xss9GstKntEUdVGB",
        );
        expect(signer2.publicKey.toBase58()).to.equal(
            "GCQcNnHZ712nkkNeGFhHRj22qbps3tmvesSu2bhb3U4f",
        );
    });
});
