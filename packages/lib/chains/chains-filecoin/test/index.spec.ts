/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";
import { Filecoin } from "../src";

import FilecoinClient from "@glif/filecoin-rpc-client";

import { FilNetwork, FilTransaction } from "../src/deposit";
import { fetchDeposits } from "../src/api/lotus";

chai.should();

loadDotEnv();

describe("Filecoin", () => {
    it.skip("mint to contract", async function () {
        this.timeout(100000000000);

        const gHash = Buffer.from(
            "o5LfFXW33It6I0gFYNArjX5p_zLnRT28lqzIVFvh_kY",
            "base64",
        );
        const pubKey = Buffer.from(
            "02d9497e5442a4c2891ac3cc3c938c16db18a934e054a00b65169221dfd370759f",
            "hex",
        );

        console.log(
            await Filecoin("testnet").getGatewayAddress("FIL", pubKey, gHash),
        );
    });
});

describe("Filecoin", () => {
    it.skip("lotus", async function () {
        this.timeout(100000000000);

        const client = new FilecoinClient({
            apiAddress:
                "https://multichain-staging.renproject.io/testnet/lotus/rpc/v0",
        });

        console.log(
            await fetchDeposits(
                client,
                "t1gvyvits5chiahib7cz6uyh6kijgqgycnaiuj47i",
                "",
                "testnet",
                0,
            ),
        );
    });
});
