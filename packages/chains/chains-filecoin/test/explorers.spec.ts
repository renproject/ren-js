/* eslint-disable no-console */

import chai from "chai";
import { config as loadDotEnv } from "dotenv";
import { Filfox } from "../src/utils/filfox";

chai.should();

loadDotEnv();

describe.skip("Filecoin explorers", () => {
    it("mint to contract", async function () {
        this.timeout(100000000000);

        const filfox = new Filfox("mainnet");

        console.log(
            "filfox",
            await filfox.fetchDeposits(
                "f15wjyn36z6x5ypq7f73yaolqbxyiiwkg5mmuyo2q",
                0,
                1,
            ),
        );
    });
});
