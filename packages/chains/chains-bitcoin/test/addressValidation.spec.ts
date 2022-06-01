/* eslint-disable no-console */
import { RenNetwork } from "@renproject/utils";
import { expect } from "chai";
import { describe, it } from "mocha";

import { Bitcoin, DigiByte, Dogecoin } from "../src";

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
    {
        chain: Dogecoin,
        addresses: {
            [RenNetwork.Mainnet]: [
                "DBs4WcRE7eysKwRxHNX88XZVCQ9M6QSUSz",
                "DDogepartyxxxxxxxxxxxxxxxxxxw1dfzr",
            ],
            [RenNetwork.Testnet]: ["2NEw92VEonb5BoiNgmCkcdewDeiwu6nb9ts"],
        },
        failing: {
            [RenNetwork.Mainnet]: [
                "bc1qk6yk2ctcu2pmtxfzhya692h774562vlv2g7dvl",
                "2NEw92VEonb5BoiNgmCkcdewDeiwu6nb9ts",
            ],
            [RenNetwork.Testnet]: [
                "bc1qk6yk2ctcu2pmtxfzhya692h774562vlv2g7dvl",
                "DBs4WcRE7eysKwRxHNX88XZVCQ9M6QSUSz",
            ],
        },
    },
];

describe("Address validation", () => {
    for (const testcase of testcases) {
        for (const network of Array.from(
            new Set([
                ...Object.keys(testcase.addresses || {}),
                ...Object.keys(testcase.failing || {}),
            ]),
        )) {
            it(`${String(testcase.chain.name)} - ${network}`, () => {
                for (const address of (testcase.addresses || { [network]: [] })[
                    network
                ]) {
                    const chain = new testcase.chain({
                        network: network as RenNetwork,
                    });
                    expect(chain.validateAddress(address)).to.equal(
                        true,
                        `Expected ${String(address)} to be valid.`,
                    );

                    // Decode, encode and then decode again.
                    // This is because
                    expect(
                        chain.addressToBytes(
                            chain.addressFromBytes(
                                chain.addressToBytes(address),
                            ),
                        ),
                    ).to.deep.equal(
                        chain.addressToBytes(address),
                        `Expected decode(encode(decode(${String(
                            address,
                        )}))) to equal decode(${String(address)}).`,
                    );
                }
                for (const address of (testcase.failing || { [network]: [] })[
                    network
                ]) {
                    const chain = new testcase.chain({
                        network: network as RenNetwork,
                    });
                    expect(chain.validateAddress(address)).to.equal(
                        false,
                        `Expected ${String(address)} to be invalid.`,
                    );
                }
            });
        }
    }
});
