import { expect } from "chai";
import { describe, it } from "mocha";

/* eslint-disable no-console */
import { RenNetwork } from "@renproject/utils";

import { Bitcoin, DigiByte } from "../src";

const testcases = [
    {
        chain: Bitcoin,
        addresses: {
            [RenNetwork.Mainnet]: [
                "17VZNX1SN5NtKa8UQFxwQbFeFc3iqRYhem",
                "3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX",
                "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
            ],
            [RenNetwork.Testnet]: [
                "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn",
                "2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc",
                "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
            ],
        },
        failing: {
            [RenNetwork.Mainnet]: ["mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn"],
            [RenNetwork.Testnet]: ["17VZNX1SN5NtKa8UQFxwQbFeFc3iqRYhem"],
        },
    },
    {
        chain: DigiByte,
        addresses: {
            [RenNetwork.Mainnet]: [
                // Random address from explorer.
                "dgb1q2whv60pvftk0h3kh286fatj005d4rfy9ehh7lt",
                "DJifYjYjshDhA5aW82DveWFqVBiqwLCoLe",
                "SiVWh3aZo9NYgrtqsPa7er2AezQAD8XswJ",
            ],
            [RenNetwork.Testnet]: ["yUxrmTPtDajuTocr4nSUZ4qn5PJ3uqS7GN"],
        },
    },
];

describe("Address validation", () => {
    for (const testcase of testcases) {
        for (const network of Object.keys(testcase.addresses)) {
            it(`${testcase.chain.asset} - ${network}`, () => {
                for (const address of (testcase.addresses || { [network]: [] })[
                    network
                ]) {
                    expect(
                        testcase.chain.utils.addressIsValid(
                            address,
                            network as RenNetwork,
                        ),
                    ).to.equal(
                        true,
                        `Expected ${String(address)} to be valid.`,
                    );
                }
                for (const address of (testcase.failing || { [network]: [] })[
                    network
                ]) {
                    expect(
                        testcase.chain.utils.addressIsValid(
                            address,
                            network as RenNetwork,
                        ),
                    ).to.equal(
                        false,
                        `Expected ${String(address)} to be invalid.`,
                    );
                }
            });
        }
    }
});
