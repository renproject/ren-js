/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import FilecoinClient from "@glif/filecoin-rpc-client";

import { Filecoin } from "../src";
import { fetchDeposits, getHeight } from "../src/utils/lotus";

chai.should();

loadDotEnv();

describe("Filecoin", () => {
    it("mint to contract", function () {
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
