/* eslint-disable no-console */

import { join } from "path";

import FilecoinClient from "@glif/filecoin-rpc-client";
import { utils } from "@renproject/utils";
import chai, { expect } from "chai";
import { config as loadDotEnv } from "dotenv";

import { Filecoin } from "../src";
import { fetchDeposits, getHeight } from "../src/utils/lotus";

chai.should();

loadDotEnv({ path: join(__dirname, "../../../../.env") });

describe("Filecoin", () => {
    it("mint to contract", () => {
        const gHash = Buffer.from(
            "o5LfFXW33It6I0gFYNArjX5p_zLnRT28lqzIVFvh_kY",
            "base64",
        );
        const pubKey = Buffer.from(
            "02d9497e5442a4c2891ac3cc3c938c16db18a934e054a00b65169221dfd370759f",
            "hex",
        );

        console.debug(
            new Filecoin({ network: "testnet" }).createGatewayAddress(
                "FIL",
                {
                    chain: "Filecoin",
                },
                pubKey,
                gHash,
            ),
        );
    });

    it("validateTransaction", () => {
        const filecoin = new Filecoin({ network: "testnet" });

        expect(
            filecoin.validateTransaction({
                txHash: "bafy2bzaceaoo4msi45t3pbhfov3guu5l34ektpjhuftyddy2rvhf2o5ajijle",
            }),
        ).to.be.true;

        expect(
            filecoin.validateTransaction({
                txHash: "bafy2bzaceaoo4msi45t3pbhfov3guu5l34ektpjhuftyddy2rvhf2o5ajijle",
                txid: "AXGg5AIgHO4ySOdnt4TldXZqU6vfCKm9J6FngY8ajU5dO6BKErI",
                txindex: "0",
            }),
        ).to.be.true;
    });

    it("validateAddress", () => {
        const testnet = new Filecoin({ network: "testnet" });

        expect(
            testnet.validateAddress(
                "t14wczuvodunv3xzexobzywpbj6qpr6jwdrbkrmbq",
            ),
        ).to.be.true;

        expect(
            utils.Ox(
                testnet.addressToBytes(
                    "t14wczuvodunv3xzexobzywpbj6qpr6jwdrbkrmbq",
                ),
            ),
        ).to.equal("0x01e5859a55c3a36bbbe49770738b3c29f41f1f26c3");

        // expect(
        //     testnet.validateAddress(""),
        // ).to.be.true;

        // expect(
        //     testnet.validateAddress(""),
        // ).to.be.false;

        // const mainnet = new Filecoin({ network: "mainnet" });

        // expect(
        //     mainnet.validateAddress(""),
        // ).to.be.true;

        // expect(
        //     mainnet.validateAddress(""),
        // ).to.be.true;

        // expect(
        //     mainnet.validateAddress(""),
        // ).to.be.false;
    });
});

// Slow test.
describe.skip("Filecoin", () => {
    it("lotus", async () => {
        const client = new FilecoinClient({
            apiAddress: `https://api.calibration.node.glif.io`,
        });

        const height = await getHeight(client);

        console.debug(
            await fetchDeposits(
                client,
                "t1gvyvits5chiahib7cz6uyh6kijgqgycnaiuj47i",
                "",
                0,
                height,
            ),
        );
    }).timeout(100000000000);
});
