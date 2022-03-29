/* eslint-disable no-console */

import { BN } from "bn.js";
import { expect } from "chai";

import {
    InputChainTransaction,
    InputType,
    OutputType,
} from "@renproject/utils";

import { Solana } from "../src/index";
import { RenVmMsgLayout } from "../src/layouts";
import { renDevnet, renTestnet } from "../src/networks";
import { makeTestSigner } from "../src/utils";
import { Connection } from "@solana/web3.js";

const testPK = Buffer.from(
    "a84252a5fcbb2bfb85a422a4833a79c23ec7906826a0298dd2a0744a4c984631d2e4cf6c0c5f3403c12e952901ab88e33fc98b07500a94136e6635a089e23f94",
    "hex",
);

describe("Solana", () => {
    describe("Layouts", () => {
        it("should encode a renvm message", () => {
            const obuff = Buffer.from(new Array(RenVmMsgLayout.span));
            RenVmMsgLayout.encode(
                {
                    p_hash: new Uint8Array([0]),
                    amount: new BN(0).toArrayLike(Buffer, "be"),
                    token: new Uint8Array([0]),
                    to: new Uint8Array([0]),
                    n_hash: new Uint8Array([0]),
                },
                obuff,
            );
        });
    });

    describe("Chain initialization", () => {
        it("should initialize with a nodejs provider", () => {
            const solana = new Solana({
                network: renDevnet,
                provider: new Connection(renDevnet.endpoint),
                signer: makeTestSigner(testPK),
            });
            expect(solana.network.isTestnet).to.equal(true);
        });

        it("should be able to check if an asset is supported", async () => {
            const solana = new Solana({
                network: renDevnet,
                provider: new Connection(renDevnet.endpoint),
                signer: makeTestSigner(testPK),
            });
            // await solana.initialize("devnet");
            const res = await solana.isMintAsset("BTC");
            expect(res).to.equal(true);
        });

        it("should be able to return the program address for an asset", async () => {
            const solana = new Solana({
                network: renDevnet,
                provider: new Connection(renDevnet.endpoint),
                signer: makeTestSigner(testPK),
            });
            const res = await solana.getMintGateway("BTC");
            expect(res).to.equal(
                "BTC5yiRuonJKcQvD9j9QwYKPx4MCGbvkWfvHFyBJG6RY",
            );
        });

        it("should be able to retrieve a burn", async () => {
            const solana = new Solana({
                network: renTestnet,
                provider: new Connection(renTestnet.endpoint),
                signer: makeTestSigner(testPK),
            });

            const burn = await solana.getInputTx(
                InputType.Burn,
                OutputType.Release,
                "BTC",
                solana.BurnNonce(1),
                () => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return {} as any;
                },
                1,
                () => {},
            );
            const tx = burn.progress.transaction as InputChainTransaction;
            expect(tx.toRecipient).to.equal(
                "2N6vHZjmFufphgEGvSttCW1SGbbpvHPGfGA",
            );
            expect(tx.amount.toString()).to.equal("20000");
        });

        // it("should be able to retrieve a mint", async () => {
        //     const solana = new Solana({
        //         network: renTestnet,
        //         provider: new Connection(renTestnet.endpoint),
        //         signer: makeTestSigner(testPK),
        //     });

        //     solana.getOutputTx()

        //     const btc = new Bitcoin();
        //     const asset = btc.asset;
        //     const renjs = new RenJS(RenNetwork.Testnet, {
        //         loadCompletedDeposits: true,
        //     });
        //     const mint = await renjs.lockAndMint({
        //         to: solana,
        //         from: btc,
        //         asset,
        //     });
        //     // Check that the gateway address hasn't changed. If the address has
        //     // changed, a new deposit should be sent to the address.
        //     expect(mint.gatewayAddress).to.equal(
        //         "2N7sNkACtgHGqy2DFRpJGtLyU6js8pQ6FAB",
        //     );
        //     // await solana.createAssociatedTokenAccount(asset);
        //     const deposit = await new Promise<LockAndMintDeposit>((resolve) =>
        //         mint.on("deposit", resolve),
        //     );
        //     // await deposit.signed();
        //     // await deposit.mint();
        //     const p = await deposit.findTransaction();
        //     expect(await p).to.equal(
        //         "2JNepYFanD3JLxv8U4kRCkR9MbqhmobTskoWZJoK4KL1dp9xJTUfpNrXAyQtckRQdr64onspr6Du4uDUBk1TVhjd",
        //     );
        // });
    });
});
