import { NetworkMainnet, NetworkTestnet } from "@renproject/utils";
import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";

import RenJS from "../../src";

chai.use((chaiBigNumber)(BigNumber));
chai.should();

describe("mercury.ts", () => {
    it("Testnet BTC UTXOS", async () => {
        const utxos = await RenJS.utils.btc.getUTXOs(NetworkTestnet)("n2e9DLJqFoAiaqjo2JFQSW1GVC6gMLXEPa", 0);
        utxos.length.should.be.greaterThan(0);
        utxos[0].txid.should.equal("af946e4182f1e5cbf0e682233b037a3ec8a5692b4f037cf016c7d11f0a97766d");
        utxos[0].value.should.equal(13370);
        utxos[0].confirmations.should.be.greaterThan(0);
    });

    it("Testnet BTC UTXOS [second API]", async () => {
        const utxos = await RenJS.utils.btc.getUTXOs(NetworkTestnet)("n2e9DLJqFoAiaqjo2JFQSW1GVC6gMLXEPa", 0);
        utxos.length.should.be.greaterThan(0);
        utxos[0].txid.should.equal("af946e4182f1e5cbf0e682233b037a3ec8a5692b4f037cf016c7d11f0a97766d");
        utxos[0].value.should.equal(13370);
        utxos[0].confirmations.should.be.greaterThan(0);
    });

    it("Testnet ZCash UTXOS", async () => {
        const utxos = await RenJS.utils.zec.getUTXOs(NetworkTestnet)("tm9iMLAuYMzJHDJZAFmzVmEa81uddHz1viK", 0);
        utxos.length.should.be.greaterThan(0);
        utxos[0].txid.should.equal("6d6f1781c589d9eafc923d480fa39656da088110b4553c043f9da2cf843d2b03");
        utxos[0].value.should.equal(100000000);

        utxos[0].confirmations.should.be.greaterThan(0);
    });

    it("Mainnet BTC UTXOS", async () => {
        const utxos = await RenJS.utils.btc.getUTXOs(NetworkMainnet)("3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX", 0);
        utxos.length.should.be.greaterThan(0);
        utxos[0].txid.should.equal("27c3a32f18d6274eb348dfd401defe6cccc2738eda277c4e55ae44370f91d98f");
        utxos[0].value.should.equal(12772);
        utxos[0].confirmations.should.be.greaterThan(0);
    });

    it("Mainnet ZEC UTXOS", async () => {
        const utxos = await RenJS.utils.zec.getUTXOs(NetworkMainnet)("t3Vz22vK5z2LcKEdg16Yv4FFneEL1zg9ojd", 0);
        utxos.length.should.be.greaterThan(0);
        utxos[0].txid.should.equal("6482a18a61cea7da8abb7ac8c44939b701889343afac7130fec4898ad1b29307");
        utxos[0].value.should.equal(7873358);
        utxos[0].confirmations.should.be.greaterThan(0);
    });

    it("Mainnet BCH UTXOS", async () => {
        const utxos = await RenJS.utils.bch.getUTXOs(NetworkMainnet)("bitcoincash:qqt6g6wul02yakpt05amm0hey67lhh7wagrrqxcmys", 0);
        utxos.length.should.be.greaterThan(0);
        utxos[0].txid.should.equal("98120f3d9834dc61839339123001717218428397ea8ab48412e53aa2bb8fbd64");
        utxos[0].value.should.equal(4532403);
        utxos[0].confirmations.should.be.greaterThan(0);
    });

    it.skip("Testnet BCH UTXOS", async () => {
        const utxos = await RenJS.utils.bch.getUTXOs(NetworkTestnet)("bchtest:qrhfzqeen0a59gy3576n00k54p2ja9s3egxdkyy7hr", 0);
        utxos.length.should.be.greaterThan(0);
        utxos[0].txid.should.equal("d9d587c9f77996e5618141a564d46f3bb7c92a7cdd8cbe9142bc43eb18a63887");
        utxos[0].value.should.equal(13999000);
        utxos[0].confirmations.should.be.greaterThan(0);
    });
});
