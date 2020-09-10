import chai from "chai";

import { value } from "../src/value";

chai.should();

require("dotenv").config();

describe("value", () => {
    it("should be able to pass in different networks", async () => {
        // tslint:disable-next-line: no-any
        const equal = (l: any, r: any) => l.should.equal(r);

        // BTC
        equal(value("0.0001", "btc").sats().toFixed(), "10000");
        equal(value("0.0001", "btc").btc().toFixed(), "0.0001");
        equal(value("0.0001", "btc")._smallest().toFixed(), "10000");
        equal(value("0.0001", "btc")._readable().toFixed(), "0.0001");

        // BCH
        equal(value("0.0001", "bch").sats().toFixed(), "10000");
        equal(value("0.0001", "bch").bch().toFixed(), "0.0001");

        // From sats
        equal(value("10000", "sats").btc().toFixed(), "0.0001");
        equal(value("10000", "sats").bch().toFixed(), "0.0001");
        equal(value("10000", "sats").sats().toFixed(), "10000");

        // ZEC
        equal(value("0.0001", "zec").zats().toFixed(), "10000");
        equal(value("0.0001", "zec").zec().toFixed(), "0.0001");

        // From eth
        equal(value("10000", "wei").eth().toFixed(), "0.00000000000001");
        equal(value("0.00000000000001", "eth").wei().toFixed(), "10000");
        equal(value("1", "wei").wei().toFixed(), "1");
        equal(value("0.1", "eth").eth().toFixed(), "0.1");
        // Test unit resolution
        equal(
            value("0.1", "eth")
                .to("ethereum" as "eth")
                .toFixed(),
            "0.1"
        );
        equal(value("0.1", "eth").to("eth").toFixed(), "0.1");
    });
});
