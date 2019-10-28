import chai from "chai";

import RenVM, {
    NetworkDevnet, NetworkLocalnet, NetworkMainnet, NetworkTestnet, Ox, strip0x,
} from "../src/index";

chai.should();

describe("RenVM networks", () => {
    it("On uninitialized class", async () => {

        const messageID = Buffer.from("JJkUamilf55lmlMKAAm5cSog5HaBBTpemmLQ8wtDYEw", "base64").toString("hex");
        console.log(await new RenVM("testnet")
            .shiftIn({ messageID, sendTo: "", contractFn: "", contractParams: [] })
            .submitToRenVM());

        for (const network of [NetworkDevnet, NetworkLocalnet, NetworkTestnet, NetworkMainnet]) {
            (typeof network.name).should.equal("string");
        }
    });
});
