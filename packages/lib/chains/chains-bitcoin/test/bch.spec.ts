/* eslint-disable no-console */
import { describe, it } from "mocha";
import { expect } from "chai";

import { BitcoinCash } from "../src";

describe("BCH", () => {
    it("address to buffer", () => {
        const bch = BitcoinCash("testnet");
        expect(
            bch
                .addressToBytes(
                    "bchtest:pq35hhjj35we555szq8xsa47ry093mkasudz8aetvr",
                )
                .toString("hex"),
        ).to.equal("08234bde528d1d9a5290100e6876be191e58eedd87");
    });
});
