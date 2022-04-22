/* eslint-disable no-console */

import chai, { expect } from "chai";
import { config as loadDotEnv } from "dotenv";

import FilecoinClient from "@glif/filecoin-rpc-client";

import { Filecoin } from "../src";
import { fetchDeposits, getHeight } from "../src/utils/lotus";
import { txidFormattedToTxid } from "../src/utils/utils";

chai.should();

loadDotEnv();

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
                txidFormatted:
                    "bafy2bzaceaoo4msi45t3pbhfov3guu5l34ektpjhuftyddy2rvhf2o5ajijle",
            }),
        ).to.be.true;

        expect(
            filecoin.validateTransaction({
                txidFormatted:
                    "bafy2bzaceaoo4msi45t3pbhfov3guu5l34ektpjhuftyddy2rvhf2o5ajijle",
                txid: "AXGg5AIgHO4ySOdnt4TldXZqU6vfCKm9J6FngY8ajU5dO6BKErI",
                txindex: "0",
            }),
        ).to.be.true;
    });
});

// Slow test.
describe.skip("Filecoin", () => {
    it("lotus", async function () {
        this.timeout(100000000000);

        const client = new FilecoinClient({
            apiAddress: `https://multichain-web-proxy.herokuapp.com/testnet`,
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
    });
});
