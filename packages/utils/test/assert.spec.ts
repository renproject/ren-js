import BigNumber from "bignumber.js";
import chai, { expect } from "chai";

import { utils } from "../src/internal";

chai.should();

describe("assert", () => {
    it("basic assert", () => {
        expect(utils.assert(true, "test")).to.equal(true);
        expect(() => utils.assert(false, "test")).to.throw(
            "Failed assertion: test",
        );
        expect(() => utils.assert(false)).to.throw("Failed assertion");
    });

    it("return true for correct types", () => {
        const buffer = Buffer.from([]);

        utils.assertType<undefined>("undefined", { a: undefined }).should.be
            .true;
        utils.assertType<null>("null", { a: null }).should.be.true;
        utils.assertType<Uint8Array | string>("Uint8Array | string", {
            a: buffer,
        }).should.be.true;
        utils.assertType<Uint8Array | string>("Uint8Array | string", { b: "1" })
            .should.be.true;
        utils.assertType<BigNumber>("BigNumber", { b: new BigNumber(1) }).should
            .be.true;
        utils.assertType<Uint8Array | string | undefined>(
            "Uint8Array | string | undefined",
            {
                c: undefined,
            },
        ).should.be.true;
        utils.assertType<number[]>("number[]", {
            a: [1, 2, 3],
        }).should.be.true;
        // eslint-disable-next-line @typescript-eslint/array-type
        utils.assertType<Array<number>>("Array<number>", {
            a: [1, 2, 3],
        }).should.be.true;
        utils.assertType<number | number[]>("number | number[]", {
            a: [1, 2, 3],
        }).should.be.true;

        utils.assertType<number | number[]>("number | number[]", {
            a: 1,
        }).should.be.true;

        utils.assertType<string[] | number[]>("string[] | number[]", {
            a: [1, 2, 3],
        }).should.be.true;

        utils.assertType<string[] | number[]>("string[] | number[]", {
            a: ["1", "2", "3"],
        }).should.be.true;
        utils.assertObject(
            {
                first: "number",
                second: "string",
            },
            {
                a: {
                    first: 1,
                    second: "1",
                },
            },
        ).should.be.true;

        utils.assertObject(
            {
                first: {
                    innerFirst: "number",
                },
                second: "string",
            },
            {
                a: {
                    first: {
                        innerFirst: 1,
                    },
                    second: "1",
                },
            },
        ).should.be.true;
    });

    it("throw error for wrong types", () => {
        expect(() => utils.assertType("undefined", { b: null })).to.throw(
            "Expected 'b' to be of type 'undefined', instead got 'null'.",
        );
        expect(() => utils.assertType("null", { b: undefined })).to.throw(
            "Expected 'b' to be of type 'null', instead got 'undefined'.",
        );
        expect(() =>
            utils.assertType("Uint8Array | string", { b: 1 }),
        ).to.throw(
            "Expected 'b' to be of type 'Uint8Array | string', instead got 'number'.",
        );
        expect(() =>
            utils.assertType("Uint8Array | string | undefined", { d: null }),
        ).to.throw(
            "Expected 'd' to be of type 'Uint8Array | string | undefined', instead got 'null'.",
        );
        expect(() =>
            utils.assertType("Array<number>", {
                a: [1, 2, "a"],
            }),
        ).to.throw(
            "Expected 'a[2]' to be of type 'number', instead got 'string'.",
        );

        expect(() =>
            utils.assertType("string | number[]", {
                a: ["1", "2", "3"],
            }),
        ).to.throw(
            "Expected 'a' to be of type 'string | number[]', instead got 'any[]'.",
        );
        expect(() =>
            utils.assertObject(
                {
                    first: {
                        innerFirst: "number",
                    },
                    second: "string",
                },
                {
                    a: {
                        first: {
                            innerFirst: "1",
                        },
                        second: "1",
                    },
                },
            ),
        ).to.throw(
            "Expected 'a[\"first\"][\"innerFirst\"]' to be of type 'number', instead got 'string'.",
        );

        expect(() =>
            utils.assertObject(
                {
                    first: "number",
                    second: "string",
                },
                {
                    a: {
                        first: "1",
                        second: "1",
                    },
                },
            ),
        ).to.throw(
            "Expected 'a[\"first\"]' to be of type 'number', instead got 'string'.",
        );
    });

    it("edge cases", () => {
        expect(utils.assertType("number", { v: 1 })).to.equal(true);
        expect(utils.assertType("Array<number>", { v: [1] })).to.equal(true);
        expect(utils.assertType("number[]", { v: [1] })).to.equal(true);

        expect(() =>
            utils.assertObject(
                {
                    first: null,
                },
                {
                    a: {
                        first: [],
                    },
                },
            ),
        ).to.throw("Cannot convert undefined or null to object");

        expect(() =>
            utils.assertObject(
                {
                    first: undefined,
                },
                {
                    a: {
                        first: [],
                    },
                },
            ),
        ).to.throw("Invalid object type definition undefined");

        utils.assertObject(
            // @ts-expect-error Should complain about missing field "first".
            {},
            {
                a: {
                    first: [],
                },
            },
        );
    });
});
