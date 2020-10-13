import { RenNetwork } from "@renproject/interfaces";
import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import RenJS from "@renproject/ren";

chai.use(chaiBigNumber(BigNumber));
chai.should();

describe("burnAndRelease response is returned correctly", () => {
    // it.skip("Chaosnet", async () => {
    //     const renJS = new RenJS(RenNetwork.Chaosnet);
    //     (
    //         await renJS
    //             .burnAndRelease({ asset: "BTC", burnNonce: 0x133 })
    //             .submit()
    //     ).in.to.should.equal("bc1q2cylsj8dvrhyd3lnvy8xz6lk604up0rk0ps72x");
    //     (
    //         await renJS
    //             .burnAndRelease({ asset: "ZEC", burnNonce: 0x5f })
    //             .submit()
    //     ).in.to.should.equal("t1eB5xqXANzuBdpiWr8u4MSRcgKggXYydc3");
    //     (
    //         await renJS
    //             .burnAndRelease({ asset: "BCH", burnNonce: 0x54 })
    //             .submit()
    //     ).in.to.should.equal(
    //         "bitcoincash:qqnm45rptzzpvg0dx04erm7mrnz27jvkevaf3ys3c5"
    //     );
    // });
    // it.skip("Testnet", async () => {
    //     const renJS = new RenJS(RenNetwork.Testnet);
    //     (
    //         await renJS
    //             .burnAndRelease({ asset: "BTC", burnNonce: 0x1 })
    //             .submit()
    //     ).in.to.should.equal("n25GA3GvGdu9MRAE16WgPBn1UmAaQ1DEws");
    //     (
    //         await renJS
    //             .burnAndRelease({ asset: "ZEC", burnNonce: 0x9c })
    //             .submit()
    //     ).in.to.should.equal("tmMsZTMQAakgna4B9wntQUppMgEaCk5Deuc");
    //     (
    //         await renJS
    //             .burnAndRelease({ asset: "BCH", burnNonce: 0x87 })
    //             .submit()
    //     ).in.to.should.equal(
    //         "bchtest:qp40jkchy4mc20waglts62h25fpxx0y9nq4z27s6zx"
    //     );
    // });
    // it.skip("Devnet", async () => {
    //     const renJS = new RenJS(RenNetwork.Devnet);
    //     (
    //         await renJS
    //             .burnAndRelease({ asset: "BTC", burnNonce: 0x2b })
    //             .submit()
    //     ).in.to.should.equal("n25GA3GvGdu9MRAE16WgPBn1UmAaQ1DEws");
    //     (
    //         await renJS
    //             .burnAndRelease({ asset: "ZEC", burnNonce: 0x7e5 })
    //             .submit()
    //     ).in.to.should.equal("tmK29k59HSB8ztLUox2q15jrC9LZtuLsCNA");
    //     (
    //         await renJS
    //             .burnAndRelease({ asset: "BCH", burnNonce: 0x9d })
    //             .submit()
    //     ).in.to.should.equal(
    //         "bchtest:qrsha0yuqedwjxzr577z4wkc9texcw73zgkvufhqwh"
    //     );
    // });
});
