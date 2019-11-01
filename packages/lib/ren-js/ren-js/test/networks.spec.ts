import chai from "chai";

import RenVM, {
    NetworkDevnet, NetworkLocalnet, NetworkMainnet, NetworkTestnet, Ox, strip0x,
} from "../src/index";

chai.should();

describe("RenVM networks", () => {
    it("On uninitialized class", async () => {
        for (const network of [NetworkDevnet, NetworkLocalnet, NetworkTestnet, NetworkMainnet]) {
            (typeof network.name).should.equal("string");
        }
    });
});
