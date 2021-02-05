import { hash160, Ox } from "@renproject/utils";
import chai from "chai";

import { RenVMProvider } from "../src/v1";

chai.should();

describe("RenVMProvider", () => {
    it("selectPublicKey", async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const response: unknown = require("./selectPublicKey.json");

        const renVMProvider = new RenVMProvider("testnet", {
            sendMessage: () => response,
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        Ox(
            hash160(
                await renVMProvider.selectPublicKey("BTC/toEthereum", "BTC"),
            ),
        ).should.equal("0x90081b2120fcd9230001f4026c207bf2633ede35");
    });
});
