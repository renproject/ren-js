import chai from "chai";

import RenJS from "../src/index";
import { NetworkDevnet, NetworkLocalnet, NetworkMainnet } from "../src/types/networks";

chai.should();

describe("RenJS networks", () => {
    it("On uninitialized class", async () => {
        for (const network of [RenJS.NetworkDetails.NetworkTestnet, RenJS.NetworkDetails.NetworkChaosnet, NetworkDevnet, NetworkLocalnet, NetworkMainnet]) {
            (typeof network.name).should.equal("string");
        }
    });
});
