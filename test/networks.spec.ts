import chai from "chai";

import RenVM, {
    NetworkDevnet, NetworkLocalnet, NetworkMainnet, NetworkTestnet, strip0x,
} from "../src/index";

require("dotenv").config();

chai.should();

describe("RenVM networks", () => {
    it("On uninitialized class", async () => {
        for (const network of [NetworkDevnet, NetworkLocalnet, NetworkTestnet, NetworkMainnet]) {
            (typeof network.name).should.equal("string");
        }
    });
});
