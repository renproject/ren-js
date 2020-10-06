import chai from "chai";
import { expect } from "earljs";

import { keccak256 } from "../src/keccak256";

chai.should();
require("dotenv").config();

describe("keccak256", () => {
    it("returns correct result for hard-coded testcases", () => {
        expect(keccak256(Buffer.from([1, 2, 3])).toString("hex")).toEqual(
            "f1885eda54b7a053318cd41e2093220dab15d65381b1157a3633a83bfd5c9239"
        );

        expect(keccak256(Buffer.from([0])).toString("hex")).toEqual(
            "bc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a"
        );
        expect(
            keccak256(
                Buffer.from("0000000000000000000000000000000000000000", "hex")
            ).toString("hex")
        ).toEqual(
            "5380c7b7ae81a58eb98d9c78de4a1fd7fd9535fc953ed2be602daaa41767312a"
        );
    });
});
