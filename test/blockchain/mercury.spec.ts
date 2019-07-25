import axios from "axios";
import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";

import { getZcashUTXOs, NetworkTestnet } from "../../src";
import { getBitcoinUTXOs } from "../../src/blockchain/btc";

require("dotenv").config();

chai.use((chaiBigNumber)(BigNumber));
chai.should();

describe("mercury.ts", () => {
    it("Bitcoin UTXOS", async () => {
        const utxos = await getBitcoinUTXOs(NetworkTestnet)("n2e9DLJqFoAiaqjo2JFQSW1GVC6gMLXEPa", 0);
        utxos.length.should.be.greaterThan(0);
        utxos[0].txid.should.equal("af946e4182f1e5cbf0e682233b037a3ec8a5692b4f037cf016c7d11f0a97766d");
        utxos[0].value.should.equal(13370);
    });

    it("Bitcoin UTXOS", async () => {
        const utxos = await getZcashUTXOs(NetworkTestnet)("tm9iMLAuYMzJHDJZAFmzVmEa81uddHz1viK", 0);
        utxos.length.should.be.greaterThan(0);
        utxos[0].txid.should.equal("6d6f1781c589d9eafc923d480fa39656da088110b4553c043f9da2cf843d2b03");
        utxos[0].value.should.equal(100000000);
    });
});
