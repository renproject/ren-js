import { RenNetwork } from "@renproject/interfaces";
import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";

import RenJS from "../src";

chai.use((chaiBigNumber)(BigNumber));
chai.should();

describe("burnAndRelease response is returned correctly", () => {
    it("Chaosnet", async () => {
        const renJS = new RenJS(RenNetwork.Chaosnet);

        (await renJS.burnAndRelease({ sendToken: "BTC", burnReference: 0x133 }).submit())
            .in.to.should.equal("bc1q2cylsj8dvrhyd3lnvy8xz6lk604up0rk0ps72x");

        (await renJS.burnAndRelease({ sendToken: "ZEC", burnReference: 0x5f }).submit())
            .in.to.should.equal("t1eB5xqXANzuBdpiWr8u4MSRcgKggXYydc3");

        (await renJS.burnAndRelease({ sendToken: "BCH", burnReference: 0x54 }).submit())
            .in.to.should.equal("bitcoincash:qqnm45rptzzpvg0dx04erm7mrnz27jvkevaf3ys3c5");
    });

    it.skip("Testnet", async () => {
        const renJS = new RenJS(RenNetwork.Testnet);

        (await renJS.burnAndRelease({ sendToken: "BTC", burnReference: 0x2dee }).submit())
            .in.to.should.equal("n25GA3GvGdu9MRAE16WgPBn1UmAaQ1DEws");

        (await renJS.burnAndRelease({ sendToken: "ZEC", burnReference: 0x37d6 }).submit())
            .in.to.should.equal("tmLbAj7EsEAR82LjSo87pSGeboEjpMmCFtv");

        (await renJS.burnAndRelease({ sendToken: "BCH", burnReference: 0xde1 }).submit())
            .in.to.should.equal("bchtest:qztw2wgjnu96f6vrrzw4j5sa9s0a60qwjcquagaf2r");
    });

    it.skip("Devnet", async () => {
        const renJS = new RenJS(RenNetwork.Devnet);

        (await renJS.burnAndRelease({ sendToken: "BTC", burnReference: 0x4e7d }).submit())
            .in.to.should.equal("n25GA3GvGdu9MRAE16WgPBn1UmAaQ1DEws");

        (await renJS.burnAndRelease({ sendToken: "ZEC", burnReference: 0x6871 }).submit())
            .in.to.should.equal("tmK29k59HSB8ztLUox2q15jrC9LZtuLsCNA");

        (await renJS.burnAndRelease({ sendToken: "BCH", burnReference: 0x1935 }).submit())
            .in.to.should.equal("bchtest:qrsha0yuqedwjxzr577z4wkc9texcw73zgkvufhqwh");

    });
});
