/* eslint-disable no-console */

import {
    InputChainTransaction,
    InputType,
    OutputType,
    utils,
} from "@renproject/utils";
import { Connection } from "@solana/web3.js";
import { expect } from "chai";

import { Solana } from "../src/index";
import { RenVMMessageLayout } from "../src/layouts";
import { renTestnet } from "../src/networks";
import { signerFromPrivateKey } from "../src/utils";

const testPK = Buffer.from(
    "a84252a5fcbb2bfb85a422a4833a79c23ec7906826a0298dd2a0744a4c984631d2e4cf6c0c5f3403c12e952901ab88e33fc98b07500a94136e6635a089e23f94",
    "hex",
);

describe("Solana", () => {
    describe("Layouts", () => {
        it("should encode a RenVM message", () => {
            const outputBuffer = Buffer.from(
                new Array(RenVMMessageLayout.span),
            );
            RenVMMessageLayout.encode(
                {
                    p_hash: utils.toNBytes(0, 32),
                    amount: utils.toNBytes(0, 32),
                    token: utils.toNBytes(0, 32),
                    to: utils.toNBytes(0, 32),
                    n_hash: utils.toNBytes(0, 32),
                },
                outputBuffer,
            );
        });
    });

    describe("Chain initialization", () => {
        it("should initialize with a nodejs provider", () => {
            const solana = new Solana({
                network: renTestnet,
                provider: new Connection(renTestnet.endpoint),
                signer: signerFromPrivateKey(testPK),
            });
            expect(solana.network.isTestnet).to.equal(true);
        });

        it("should be able to check if an asset is supported", async () => {
            const solana = new Solana({
                network: renTestnet,
                provider: new Connection(renTestnet.endpoint),
                signer: signerFromPrivateKey(testPK),
            });
            // await solana.initialize("devnet");
            const res = await solana.isMintAsset("BTC");
            expect(res).to.equal(true);
        });

        it("should be able to return the program address for an asset", async () => {
            const solana = new Solana({
                network: renTestnet,
                provider: new Connection(renTestnet.endpoint),
                signer: signerFromPrivateKey(testPK),
            });
            const res = await solana.getMintGateway("BTC");
            expect(res).to.equal(
                "FsEACSS3nKamRKdJBaBDpZtDXWrHR2nByahr4ReoYMBH",
            );
        });

        it("should be able to retrieve a burn", async () => {
            const solana = new Solana({
                network: renTestnet,
                provider: new Connection(renTestnet.endpoint),
                signer: signerFromPrivateKey(testPK),
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
        //         signer: signerFromPrivateKey(testPK),
        //     });

        //     solana.getOutputTx()

        //     const btc = new Bitcoin();
        //     const asset = btc.asset;
        //     const renJS = new RenJS(RenNetwork.Testnet, {
        //         loadCompletedDeposits: true,
        //     });
        //     const mint = await renJS.lockAndMint({
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
