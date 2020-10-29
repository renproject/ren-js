// tslint:disable: mocha-no-side-effect-code

import chai from "chai";
import { expect } from "earljs";

import { hash160, keccak256, ripemd160, sha256 } from "../src/hash";

chai.should();

const testCases = [
    {
        msg: Buffer.from([1, 2, 3]),
        hashes: {
            keccak256:
                "f1885eda54b7a053318cd41e2093220dab15d65381b1157a3633a83bfd5c9239",
            ripemd160: "79f901da2609f020adadbf2e5f68a16c8c3f7d57",
            sha256:
                "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
            hash160: "9bc4860bb936abf262d7a51f74b4304833fee3b2",
        },
    },
    {
        msg: Buffer.from([]),
        hashes: {
            keccak256:
                "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
            ripemd160: "9c1185a5c5e9fc54612808977ee8f548b2258d31",
            sha256:
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            hash160: "b472a266d0bd89c13706a4132ccfb16f7c3b9fcb",
        },
    },
    {
        msg: Buffer.from("00".repeat(20), "hex"),
        hashes: {
            keccak256:
                "5380c7b7ae81a58eb98d9c78de4a1fd7fd9535fc953ed2be602daaa41767312a",
            ripemd160: "5c00bd4aca04a9057c09b20b05f723f2e23deb65",
            sha256:
                "de47c9b27eb8d300dbb5f2c353e632c393262cf06340c4fa7f1b40c4cbd36f90",
            hash160: "944f997c5553a6f3e1028e707c71b5fa0dd3afa7",
        },
    },
];

const hashers = { keccak256, ripemd160, sha256, hash160 };

describe("keccak256", () => {
    it("returns correct result for hard-coded testcases", () => {
        for (const testCase of testCases) {
            for (const hash of Object.keys(testCase.hashes)) {
                expect(hashers[hash](testCase.msg).toString("hex")).toEqual(
                    testCase.hashes[hash],
                );
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
    console.log(JSON.stringify(obj, null, "    "))
}
 * ```
 */
