import { RenContract } from "@renproject/interfaces";
import { Ox } from "@renproject/utils";
import chai from "chai";

import { RenVMProvider } from "../build/main";

chai.should();

require("dotenv").config();

describe("RenVMProvider", () => {
    it("selectPublicKey", async () => {
        const response = require("./selectPublicKey.json");

        const renVMProvider = new RenVMProvider({ sendMessage: () => response } as any); // tslint:disable-line: no-any
        Ox((await renVMProvider.selectPublicKey(RenContract.Btc2Eth)))
            .should.equal("0xe771b00d9f6d7125af80281ad778123ba468f1f2");
    });
});
