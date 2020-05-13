import { devnet, localnet, mainnet } from "@renproject/contracts";
import chai from "chai";

import RenJS from "../src/index";

chai.should();

describe("RenJS networks", () => {
    it("On uninitialized class", async () => {
        for (const network of [RenJS.NetworkDetails.NetworkTestnet, RenJS.NetworkDetails.NetworkChaosnet, devnet, localnet, mainnet]) {
            (typeof network.name).should.equal("string");
        }
    });
});
