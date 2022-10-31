/* eslint-disable no-console */

import { join } from "path";

import chai from "chai";
import { config as loadDotEnv } from "dotenv";

import { Filfox } from "../src/utils/filfox";

chai.should();

loadDotEnv({ path: join(__dirname, "../../../../.env") });

describe.skip("Filecoin explorers", () => {
    it("mint to contract", async () => {
        const filfox = new Filfox("mainnet");

        console.debug(
            "filfox",
            await filfox.fetchDeposits(
                "f15wjyn36z6x5ypq7f73yaolqbxyiiwkg5mmuyo2q",
                0,
                1,
            ),
        );
    }).timeout(100000000000);
});
