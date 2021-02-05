/* eslint-disable no-console */
import { describe, it } from "mocha";

import { BitcoinCash } from "../src";

describe("BCH", () => {
    it("address to buffer", () => {
        const bch = BitcoinCash("testnet");
        console.log(
            bch
                .addressStringToBytes(
                    "bchtest:pq35hhjj35we555szq8xsa47ry093mkasudz8aetvr",
                )
                .toString("hex"),
        );
    });
});
