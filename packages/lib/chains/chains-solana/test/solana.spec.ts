/* eslint-disable no-console */

import { expect } from "earljs";
import { Solana } from "../src/index";
import { renDevnet } from "../src/networks";
import { RenVmMsgLayout } from "../src/layouts";

import { makeTestProvider } from "../src/utils";
import { Bitcoin } from "../../chains";
import RenJS from "../../../ren";
import { BN } from "bn.js";
import { RenVMProvider } from "@renproject/rpc/build/main/v1";
import { RenNetwork } from "@renproject/interfaces";

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
                    amount: new BN(0),
                    s_hash: new Uint8Array([0]),
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
                new RenVMProvider(RenNetwork.DevnetVDot3),
                renDevnet,
            );
            expect(solana.renNetworkDetails.isTestnet).toEqual(true);
        });

        it("should be able to check if an asset is supported", async () => {
            const solana = new Solana(
                makeTestProvider(renDevnet, testPK),
                new RenVMProvider(RenNetwork.DevnetVDot3),
                renDevnet,
            );
            // await solana.initialize("devnet");
            const res = await solana.assetIsSupported("BTC");
            expect(res).toEqual(true);
        });

        it("should be able to return the program address for an asset", async () => {
            const solana = new Solana(
                makeTestProvider(renDevnet, testPK),
                new RenVMProvider(RenNetwork.DevnetVDot3),
                renDevnet,
            );
            await solana.initialize("testnet");
            const res = solana.resolveTokenGatewayContract("BTC");
            expect(res).toEqual("Fw87wZPnQ9YMwZs5o9qP9FeqaciqcWNdH7Z4a6mKURkw");
        });

        it("should be able to generate a gateway address", async () => {
            const solana = new Solana(
                makeTestProvider(renDevnet, testPK),
                new RenVMProvider(RenNetwork.DevnetVDot3),
                renDevnet,
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
                "2N82BTVW2whJXhzD42GuPCtb5zSgRzhfcBe",
            );
        });

        it("should be able to retrieve a mint", async () => {
            const solana = new Solana(
                makeTestProvider(renDevnet, testPK),
                new RenVMProvider(RenNetwork.DevnetVDot3),
                renDevnet,
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
        });
    });
});
