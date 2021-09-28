import BigNumber from "bignumber.js";
import chai, { expect } from "chai";

import { assert, assertObject, assertType } from "../src/assert";

chai.should();

describe("assert", () => {
    it("basic assert", () => {
        expect(assert(true, "test")).to.equal(true);
        expect(() => assert(false, "test")).to.throw("Failed assertion: test");
        expect(() => assert(false)).to.throw("Failed assertion");
    });

    it("return true for correct types", () => {
        const buffer = Buffer.from([]);

        assertType<undefined>("undefined", { a: undefined }).should.be.true;
        assertType<null>("null", { a: null }).should.be.true;
        assertType<Buffer | string>("Buffer | string", { a: buffer }).should.be
            .true;
        assertType<Buffer | string>("Buffer | string", { b: "1" }).should.be
            .true;
        assertType<BigNumber>("BigNumber", { b: new BigNumber(1) }).should.be
            .true;
        assertType<Buffer | string | undefined>("Buffer | string | undefined", {
            c: undefined,
        }).should.be.true;
        assertType<number[]>("number[]", {
            a: [1, 2, 3],
        }).should.be.true;
        // eslint-disable-next-line @typescript-eslint/array-type
        assertType<Array<number>>("Array<number>", {
            a: [1, 2, 3],
        }).should.be.true;
        assertType<number | number[]>("number | number[]", {
            a: [1, 2, 3],
        }).should.be.true;

        assertType<number | number[]>("number | number[]", {
            a: 1,
        }).should.be.true;

        assertType<string[] | number[]>("string[] | number[]", {
            a: [1, 2, 3],
        }).should.be.true;

        assertType<string[] | number[]>("string[] | number[]", {
            a: ["1", "2", "3"],
        }).should.be.true;
        assertObject(
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

        assertObject(
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
        expect(() => assertType("undefined", { b: null })).to.throw(
            "Expected b to be of type 'undefined', instead got 'null'.",
        );
        expect(() => assertType("null", { b: undefined })).to.throw(
            "Expected b to be of type 'null', instead got 'undefined'.",
        );
        expect(() => assertType("Buffer | string", { b: 1 })).to.throw(
            "Expected b to be of type 'Buffer | string', instead got 'number'.",
        );
        expect(() =>
            assertType("Buffer | string | undefined", { d: null }),
        ).to.throw(
            "Expected d to be of type 'Buffer | string | undefined', instead got 'null'.",
        );
        expect(() =>
            assertType("Array<number>", {
                a: [1, 2, "a"],
            }),
        ).to.throw(
            "Expected a[2] to be of type 'number', instead got 'string'.",
        );

        expect(() =>
            assertType("string | number[]", {
                a: ["1", "2", "3"],
            }),
        ).to.throw(
            "Expected a to be of type 'string | number[]', instead got 'any[]'.",
        );
        expect(() =>
            assertObject(
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
            "Expected a[\"first\"][\"innerFirst\"] to be of type 'number', instead got 'string'.",
        );

        expect(() =>
            assertObject(
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
            "Expected a[\"first\"] to be of type 'number', instead got 'string'.",
        );
    });

    it("edge cases", () => {
        expect(assertType("number", { v: 1 })).to.equal(true);
        expect(assertType("Array<number>", { v: [1] })).to.equal(true);
        expect(assertType("number[]", { v: [1] })).to.equal(true);

        expect(() =>
            assertObject(
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
            assertObject(
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

        assertObject(
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
