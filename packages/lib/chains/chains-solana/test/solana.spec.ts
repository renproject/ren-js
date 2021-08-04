/* eslint-disable no-console */

import { expect } from "earljs";
import { Solana } from "../src/index";
import { renDevnet, renTestnet } from "../src/networks";
import { RenVmMsgLayout } from "../src/layouts";

import { makeTestProvider } from "../src/utils";
import { Bitcoin } from "../../chains";
import RenJS, { LockAndMintDeposit } from "../../../ren";
import { BN } from "bn.js";
import { EventEmitterTyped, RenNetwork } from "@renproject/interfaces";
import EventEmitter from "events";

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
            const solana = new Solana(
                makeTestProvider(renDevnet, testPK),
                renDevnet,
            );
            expect(solana.renNetworkDetails.isTestnet).toEqual(true);
        });

        it("should be able to check if an asset is supported", async () => {
            const solana = new Solana(
                makeTestProvider(renDevnet, testPK),
                renDevnet,
            );
            // await solana.initialize("devnet");
            const res = await solana.assetIsSupported("BTC");
            expect(res).toEqual(true);
        });

        it("should be able to return the program address for an asset", async () => {
            const solana = new Solana(
                makeTestProvider(renDevnet, testPK),
                renDevnet,
            );
            await solana.initialize("testnet");
            const res = solana.resolveTokenGatewayContract("BTC");
            expect(res).toEqual("BTC5yiRuonJKcQvD9j9QwYKPx4MCGbvkWfvHFyBJG6RY");
        });

        it("should be able to generate a gateway address", async () => {
            const solana = new Solana(
                makeTestProvider(renDevnet, testPK),
                renDevnet,
            );
            const btc = new Bitcoin();
            const renjs = new RenJS(RenNetwork.Devnet);
            const mint = await renjs.lockAndMint({
                to: solana,
                from: btc,
                asset: "BTC",
            });
            // FIXME: this will stop working once shards shuffle
            expect(mint.gatewayAddress).toEqual(
                "2N2fCiskRfm4FVWg5eg9mAiRVCEewqUicGL",
            );
        });

        it("should be able to retrieve a burn", async () => {
            const solana = new Solana(
                makeTestProvider(renTestnet, testPK),
                renTestnet,
            );

            const emitter = new EventEmitter() as EventEmitterTyped<{
                transactionHash: [string];
            }>;
            const burn = await solana.findBurn("BTC", emitter, undefined, 1);
            expect(burn.to).toEqual("2N6vHZjmFufphgEGvSttCW1SGbbpvHPGfGA");
            expect(burn.amount.toString()).toEqual("20000");
        });

        it("should be able to construct burn params", () => {
            const solana = new Solana(
                makeTestProvider(renDevnet, testPK),
                renDevnet,
            ).Account({ amount: "20000" });
            // const emitter = new EventEmitter();
            const btcAddressHex =
                "d2e4cf6c0c5f3403c12e952901ab88e33fc98b07500a94136e6635a089e23f94";
            const params = solana.getBurnParams("BTC", btcAddressHex);
            expect(params.contractCalls[0]).toLooseEqual({
                sendTo: "d2e4cf6c0c5f3403c12e952901ab88e33fc98b07500a94136e6635a089e23f94",
                contractFn: "",
                contractParams: [
                    {
                        name: "amount",
                        value: "20000",
                        type: "string",
                    },
                    {
                        name: "recipient",
                        value: Buffer.from(btcAddressHex, "hex"),
                        type: "bytes",
                    },
                ],
            });
        });

        it("should be able to retrieve a mint", async () => {
            const solana = new Solana(
                makeTestProvider(renTestnet, testPK),
                renTestnet,
            );
            const btc = new Bitcoin();
            const asset = btc.asset;
            const renjs = new RenJS(RenNetwork.Testnet, {
                loadCompletedDeposits: true,
            });
            const mint = await renjs.lockAndMint({
                to: solana,
                from: btc,
                asset,
            });
            // Check that the gateway address hasn't changed. If the address has
            // changed, a new deposit should be sent to the address.
            expect(mint.gatewayAddress).toEqual(
                "2N7sNkACtgHGqy2DFRpJGtLyU6js8pQ6FAB",
            );
            // await solana.createAssociatedTokenAccount(asset);
            const deposit = await new Promise<LockAndMintDeposit>((resolve) =>
                mint.on("deposit", resolve),
            );
            // await deposit.signed();
            // await deposit.mint();
            const p = await deposit.findTransaction();
            expect(await p).toEqual(
                "2JNepYFanD3JLxv8U4kRCkR9MbqhmobTskoWZJoK4KL1dp9xJTUfpNrXAyQtckRQdr64onspr6Du4uDUBk1TVhjd",
            );
        });
    });
});
