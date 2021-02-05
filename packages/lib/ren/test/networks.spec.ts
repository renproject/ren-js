import { renDevnet, renLocalnet, renMainnet } from "@renproject/contracts";
import chai from "chai";

import RenJS from "../src/index";

chai.should();

describe("RenJS networks", () => {
    it("On uninitialized class", async () => {
        for (const network of [
            RenJS.NetworkDetails.Testnet,
            RenJS.NetworkDetails.Chaosnet,
            renDevnet,
            renLocalnet,
            renMainnet,
        ]) {
            (typeof network.name).should.equal("string");
        }
    });
});
