import { renMainnet } from "@renproject/chains-solana";
import { Connection } from "@solana/web3.js";
import { expect } from "chai";

import { Solana } from "../src";
import { getBurnFromNonce, getBurnFromTxid } from "../src/utils";

const getBurn = async (solana: Solana, asset: string, nonce: number) => {
    const btcMintGateway = await solana.getMintGateway(asset, {
        publicKey: true,
    });

    const burn = await getBurnFromNonce(
        solana.provider,
        "Solana",
        asset,
        btcMintGateway,
        nonce,
    );

    if (burn) {
        const burnAlt = await getBurnFromTxid(
            solana.provider,
            "Solana",
            asset,
            btcMintGateway,
            burn.txHash,
            undefined,
        );

        expect(burn).to.deep.equal(burnAlt);
    }

    return burn;
};

describe("Nonce utils", () => {
    it("getBurnFromNonce", async () => {
        const provider = new Connection(renMainnet.endpoint);
        const solana = new Solana({
            network: "testnet",
            provider,
        });

        expect(await getBurn(solana, "BTC", 1)).to.deep.equal({
            chain: "Solana",
            txid: "MjRGEHii72dscxoM861vqD1kYWKJx2Y07tc3ve_sVY1zkQNqfSkjUM7X3heJSJqiiiC7rS4RZqvEVnNG8F41AQ",
            txindex: "0",
            txHash: "21DbEbLNRAyABxfNCBtZTfBRzNytDCPRT5H1gvnW4xNyE51u2GgTqD5hVFHxwhe2qkqv1f53PKy2JZ93zo8Kaa8Y",
            asset: "BTC",
            amount: "50000",
            nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE",
            toRecipient: "3JBNEfMZWv9Sz7fa7pG1P4anrj8grSb6ru",
            explorerLink: "",
        });

        expect(await getBurn(solana, "BTC", 100000000000)).to.be.undefined;

        expect(await getBurn(solana, "ZEC", 1)).to.deep.equal({
            chain: "Solana",
            txid: "pWCIqSwFB35aginG3OLcuHQQmFnvfc8wZ0Q-kBZ4UFo7CkVFKcrv_TfFNj_crZjKWVAjFldN7i4ShbbDArEaCw",
            txindex: "0",
            txHash: "4JmnktbDHNzfuAzooapuQ38RpGPwVD9dcuoj1deHnt6oFcEZgMQarLqpjZZTuEm67HJm3dC3fpm6NV9WD22ZbMgv",
            asset: "ZEC",
            amount: "818769",
            nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE",
            toRecipient: "t1gZoFwCAUnZ7KA3BgKETKqwUQypAs9e9Eg",
            explorerLink: "",
        });
    });
});
