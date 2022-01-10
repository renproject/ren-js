import { expect } from "chai";
/* eslint-disable no-console */
import { describe, it } from "mocha";

import { BitcoinCash } from "../src";

describe.only("BCH", () => {
    it("address to buffer", () => {
        const bch = BitcoinCash("testnet");
        expect(
            bch
                .addressToBytes(
                    "bitcoincash:qp0649tku3dvhjtx9d4t7v3j9xm5322ft5qqtl36wz",
                )
                .toString("hex"),
        ).to.equal("005faa9576e45acbc9662b6abf323229b748a9495d");

        expect(
            bch
                .addressToBytes("19iqYbeATe4RxghQZJnYVFU4mjUUu76EA6")
                .toString("hex"),
        ).to.equal("005faa9576e45acbc9662b6abf323229b748a9495d0df5accb");
    });
});
