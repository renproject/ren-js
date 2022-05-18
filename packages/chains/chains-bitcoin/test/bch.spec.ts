import { utils } from "@renproject/utils";
import { expect } from "chai";
/* eslint-disable no-console */
import { describe, it } from "mocha";

import { BitcoinCash } from "../src";

describe("BCH", () => {
    it("address to buffer", () => {
        const bch = new BitcoinCash({ network: "testnet" });
        expect(
            utils.toHex(
                bch.addressToBytes(
                    "bchtest:pq35hhjj35we555szq8xsa47ry093mkasudz8aetvr",
                ),
            ),
        ).to.equal("08234bde528d1d9a5290100e6876be191e58eedd87");
    });
});
