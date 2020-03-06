// import test, { ExecutionContext } from "ava";

// import { value } from "../index";

// test("value conversion", (t: ExecutionContext<unknown>) => {
//     // BTC
//     t.is(value("0.0001", "btc").sats().toFixed(), "10000");
//     t.is(value("0.0001", "btc").btc().toFixed(), "0.0001");
//     t.is(value("0.0001", "btc")._smallest().toFixed(), "10000");
//     t.is(value("0.0001", "btc")._readable().toFixed(), "0.0001");

//     // BCH
//     t.is(value("0.0001", "bch").sats().toFixed(), "10000");
//     t.is(value("0.0001", "bch").bch().toFixed(), "0.0001");

//     // From sats
//     t.is(value("10000", "sats").btc().toFixed(), "0.0001");
//     t.is(value("10000", "sats").bch().toFixed(), "0.0001");
//     t.is(value("10000", "sats").sats().toFixed(), "10000");

//     // ZEC
//     t.is(value("0.0001", "zec").zats().toFixed(), "10000");
//     t.is(value("0.0001", "zec").zec().toFixed(), "0.0001");

//     // From eth
//     t.is(value("10000", "wei").eth().toFixed(), "0.00000000000001");
//     t.is(value("0.00000000000001", "eth").wei().toFixed(), "10000");
//     t.is(value("1", "wei").wei().toFixed(), "1");
//     t.is(value("0.1", "eth").eth().toFixed(), "0.1");
//     // Test unit resolution
//     t.is(value("0.1", "eth").to("ethereum" as "eth").toFixed(), "0.1");
//     t.is(value("0.1", "eth").to("eth").toFixed(), "0.1");
// });
