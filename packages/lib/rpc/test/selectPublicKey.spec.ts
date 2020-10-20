import { hash160, Ox } from "@renproject/utils";
import chai from "chai";

import { RenVMProvider } from "../src/v1";

chai.should();

require("dotenv").config();

describe("RenVMProvider", () => {
    it("selectPublicKey", async () => {
        const response = require("./selectPublicKey.json");

        const renVMProvider = new RenVMProvider("testnet", {
            sendMessage: () => response
        } as any); // tslint:disable-line: no-any
        Ox(hash160(await renVMProvider.selectPublicKey("BTC"))).should.equal(
            "0xe771b00d9f6d7125af80281ad778123ba468f1f2"
        );
    });
});
