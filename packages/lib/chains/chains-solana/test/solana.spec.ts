/* eslint-disable no-console */

import { expect } from "earljs";
import {
    Solana,
    makeNodeProvider,
    renTestnet,
    RenVmMsgLayout,
} from "../src/index";
import { Bitcoin } from "../../chains";
import RenJS from "../../../ren";
import { BN } from "bn.js";
import { array, struct, u64, u8 } from "@project-serum/borsh";

// import * as chai from "chai";
// chai.should();

describe("Solana", () => {
    describe.only("Layouts", () => {
        it("should encode a renvm message", () => {
            const payload = {};
            // const tstruct = struct([array(u8(), 1, "t")]);
            const nstruct = struct([u64("t")]);
            const obuff = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
            //tstruct.encode({ t: new Uint8Array([255]) }, obuff);
            nstruct.encode({ t: new BN(255) }, obuff);
            // RenVmMsgLayout.encode({
            //     p_hash: new Uint8Array([0]),
            //     amount: new BigNumber(0),
            //     s_hash: new Uint8Array([0]),
            //     to: new Uint8Array([0]),
            //     n_hash: new Uint8Array([0]),
            // });
        });
    });
    describe("Chain initialization", () => {
        it("should initialize with a nodejs provider", () => {
            const solana = new Solana(makeNodeProvider(renTestnet));
            expect(solana.renNetworkDetails.isTestnet).toEqual(true);
        });

        it("should be able to check if an asset is supported", async () => {
            const solana = new Solana(makeNodeProvider(renTestnet));
            await solana.initialize("testnet");
            const res = await solana.assetIsSupported("BTC");
            expect(res).toEqual(true);
        });

        it("should be able to return the program address for an asset", async () => {
            const solana = new Solana(makeNodeProvider(renTestnet));
            await solana.initialize("testnet");
            const res = solana.resolveTokenGatewayContract("BTC");
            expect(res).toEqual("9TaQuUfNMC5rFvdtzhHPk84WaFH3SFnweZn4tw9RriDP");
        });

        it("should be able to generate a gateway address", async () => {
            const solana = new Solana(makeNodeProvider(renTestnet));
            const btc = new Bitcoin();
            const renjs = new RenJS("testnet-v0.3");
            const mint = await renjs.lockAndMint({
                to: solana,
                from: btc,
                asset: "BTC",
            });
            expect(mint.gatewayAddress.length).toEqual(
                "2NEHGLHYhUh6DaysRtEuZwZRTr1WTakiKBP".length,
            );
        });

        it("should be able to mint", async () => {
            const solana = new Solana(makeNodeProvider(renTestnet));
            const btc = new Bitcoin();
            const renjs = new RenJS("testnet-v0.3");
            const mint = await renjs.lockAndMint({
                to: solana,
                from: btc,
                asset: "BTC",
            });
            expect(mint.gatewayAddress.length).toEqual(
                "2NEHGLHYhUh6DaysRtEuZwZRTr1WTakiKBP".length,
            );
        });
    });
});
