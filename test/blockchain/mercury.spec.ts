import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";

import { getZcashUTXOs, NetworkTestnet } from "../../src";
import { getBitcoinUTXOs } from "../../src/blockchain/btc";

require("dotenv").config();

chai.use((chaiBigNumber)(BigNumber));
chai.should();

describe.skip("mercury.ts", () => {
    it("Bitcoin UTXOS", async () => {
        (await getBitcoinUTXOs(NetworkTestnet)("n2e9DLJqFoAiaqjo2JFQSW1GVC6gMLXEPa", 0))
            .should.deep.equal(
                [{
                    txHash: 'af946e4182f1e5cbf0e682233b037a3ec8a5692b4f037cf016c7d11f0a97766d',
                    amount: 0,
                    scriptPubKey: '76a914e7b6aae75d4be114d3c9fe64466931e60be8fa1e88ac',
                    vout: 1
                }]
            );
    });

    it("Bitcoin UTXOS", async () => {
        (await getZcashUTXOs(NetworkTestnet)("tm9iMLAuYMzJHDJZAFmzVmEa81uddHz1viK", 0))
            .should.deep.equal(
                [{
                    txHash: '6d6f1781c589d9eafc923d480fa39656da088110b4553c043f9da2cf843d2b03',
                    amount: 0,
                    scriptPubKey: '76a914e7b6aae75d4be114d3c9fe64466931e60be8fa1e88ac',
                    vout: 1
                }]
            );
    });
});
