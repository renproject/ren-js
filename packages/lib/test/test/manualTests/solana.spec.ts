import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { createAssociatedTokenAccount } from "@project-serum/associated-token";
import { Solana } from "@renproject/chains-solana/src";
import { renTestnet } from "@renproject/chains-solana/src/networks";
import { makeTestSigner } from "@renproject/chains-solana/src/utils";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

chai.should();

loadDotEnv();

describe("BTC/toSolana", () => {
    it("BTC/toSolana", async function () {
        this.timeout(100000000000);

        const signer = makeTestSigner(
            Buffer.from(process.env.TESTNET_SOLANA_KEY_2, "hex"),
        );
        const provider = new Connection(renTestnet.endpoint);

        const to = new Solana({
            network: renTestnet,
            provider,
            signer,
        });
        const tokenMintId = new PublicKey(await to.getMintAsset("BTC"));

        const createTxInstruction = await createAssociatedTokenAccount(
            signer.publicKey,
            signer.publicKey,
            tokenMintId,
        );
        const createTx = new Transaction();
        createTx.add(createTxInstruction);
        createTx.feePayer = signer.publicKey;
        createTx.recentBlockhash = (
            await provider.getRecentBlockhash()
        ).blockhash;
        const signedTx = await signer.signTransaction(createTx);
        await signedTx.serialize();
    });
});
