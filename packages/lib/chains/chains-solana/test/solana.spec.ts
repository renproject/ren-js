/* eslint-disable no-console */

import { expect } from "earljs";
import { Solana } from "../src/index";
import { renMainnet } from "../src/networks";
import { RenVmMsgLayout } from "../src/layouts";

import { makeTestProvider } from "../src/utils";
import { Bitcoin } from "../../chains";
import RenJS from "../../../ren";
import { BN } from "bn.js";
import { RenVMProvider } from "@renproject/rpc/build/main/v1";
import { RenNetwork } from "@renproject/interfaces";
import { LockAndMintDeposit } from "../../../ren/build/main/lockAndMint";
import EventEmitter = require("events");

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
                makeTestProvider(renMainnet, testPK),
                renMainnet,
            );
            expect(solana.renNetworkDetails.isTestnet).toEqual(true);
        });

        it("should be able to check if an asset is supported", async () => {
            const solana = new Solana(
                makeTestProvider(renMainnet, testPK),
                renMainnet,
            );
            // await solana.initialize("devnet");
            const res = await solana.assetIsSupported("BTC");
            expect(res).toEqual(true);
        });

        it("should be able to return the program address for an asset", async () => {
            const solana = new Solana(
                makeTestProvider(renMainnet, testPK),
                renMainnet,
            );
            await solana.initialize("testnet");
            const res = solana.resolveTokenGatewayContract("BTC");
            expect(res).toEqual("BTC5yiRuonJKcQvD9j9QwYKPx4MCGbvkWfvHFyBJG6RY");
        });

        it("should be able to generate a gateway address", async () => {
            const solana = new Solana(
                makeTestProvider(renMainnet, testPK),
                renMainnet,
            );
            const btc = new Bitcoin();
            const renjs = new RenJS(RenNetwork.DevnetVDot3);
            const mint = await renjs.lockAndMint({
                to: solana,
                from: btc,
                asset: "BTC",
            });
            //FIXME: this will stop working once shards shuffle
            expect(mint.gatewayAddress).toEqual(
                "2N2fCiskRfm4FVWg5eg9mAiRVCEewqUicGL",
            );
        });

        it.only("should be able to retrieve a burn", async () => {
            const solana = new Solana(
                makeTestProvider(renMainnet, testPK),
                renMainnet,
            );
            const emitter = new EventEmitter();
            const burn = await solana.findBurnTransaction(
                "BTC",
                { burnNonce: 1 },
                emitter,
                console,
            );
            // Just check 4 characters to avoid including random user's BTC
            // address.
            expect(burn.to.length).toEqual(34);
            expect(burn.to.slice(0, 4)).toEqual("3JBN");
            expect(burn.amount.toString()).toEqual("50000");
        });

        it("should be able to construct burn params", async () => {
            const solana = new Solana(
                makeTestProvider(renMainnet, testPK),
                renMainnet,
            ).Account({ amount: "20000" });
            // const emitter = new EventEmitter();
            const btcAddressHex =
                "d2e4cf6c0c5f3403c12e952901ab88e33fc98b07500a94136e6635a089e23f94";
            const params = solana.getBurnParams("BTC", btcAddressHex);
            expect(params.contractCalls[0]).toLooseEqual({
                sendTo:
                    "d2e4cf6c0c5f3403c12e952901ab88e33fc98b07500a94136e6635a089e23f94",
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
                makeTestProvider(renMainnet, testPK),
                renMainnet,
            );
            const btc = new Bitcoin();
            const renjs = new RenJS("devnet-v0.3", {
                loadCompletedDeposits: true,
            });
            const mint = await renjs.lockAndMint({
                to: solana,
                from: btc,
                asset: "BTC",
            });
            const p = new Promise<any>((resolve, reject) =>
                mint.on("deposit", (deposit) => {
                    (async () => {
                        // const d = await deposit.signed();
                        const m = await deposit.findTransaction();
                        resolve(m);
                    })().catch(reject);
                }),
            );
            expect(await p).toEqual(
                "35MBhJBFZ8eHDFnGX4mfuxZMZ29CPGssp8Hbs2o8Gwssow27FT9MKjavrqzWp2tjJ5wnmU8HYbbRAvnMCuSzRWxD",
            );
        });
    });
});
