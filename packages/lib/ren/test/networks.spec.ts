import { NetworkDevnet, NetworkLocalnet, NetworkMainnet } from "@renproject/utils";
import chai from "chai";

import RenJS from "../src/index";

chai.should();

describe("RenJS networks", () => {
    it("On uninitialized class", async () => {
        for (const network of [RenJS.NetworkDetails.NetworkTestnet, RenJS.NetworkDetails.NetworkChaosnet, NetworkDevnet, NetworkLocalnet, NetworkMainnet]) {
            (typeof network.name).should.equal("string");
        }
    });
});
