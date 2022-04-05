import chai, { expect } from "chai";

import { utils } from "../src";
import { keccak256 } from "../src/internal/hashes";

chai.should();

const testCases = [
    {
        msg: Buffer.from([1, 2, 3]),
        hashes: {
            keccak256:
                "f1885eda54b7a053318cd41e2093220dab15d65381b1157a3633a83bfd5c9239",
        },
    },
    {
        msg: Buffer.from([]),
        hashes: {
            keccak256:
                "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
        },
    },
    {
        msg: Buffer.from("00".repeat(20), "hex"),
        hashes: {
            keccak256:
                "5380c7b7ae81a58eb98d9c78de4a1fd7fd9535fc953ed2be602daaa41767312a",
        },
    },
];

const hashers = { keccak256 };

describe("keccak256", () => {
    it("returns correct result for hard-coded testcases", () => {
        for (const testCase of testCases) {
            for (const hash of Object.keys(testCase.hashes)) {
                const result = hashers[hash](testCase.msg);
                expect(result instanceof Uint8Array).to.be.true;
                expect(utils.toHex(result)).to.equal(testCase.hashes[hash]);
            }
        }
    });
});

/*
 * Generate new test cases:
 *
 * ```js
const { hash160, keccak256, ripemd160, sha256 } = require("@renproject/utils");
let msg = Buffer.from([0])
let hashers = {keccak256, ripemd160, sha256, hash160 }
let hash = (msg) => {
    let obj = {};
    for (const hash of Object.keys(hashers)) {
        obj[hash] = hashers[hash](msg).toString("hex");
    }
    console.debug(JSON.stringify(obj, null, "    "))
}
 * ```
 */
