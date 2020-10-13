// tslint:disable: no-unused-expression

import chai from "chai";
import { expect } from "earljs";
import BigNumber from "bignumber.js";

import { assert, assertObject, assertType } from "../src/assert";

chai.should();
require("dotenv").config();

describe("assert", () => {
    it("basic assert", () => {
        expect(assert(true, "test")).toEqual(true);
        expect(() => assert(false, "test")).toThrow(
            new Error("Failed assertion: test")
        );
        expect(() => assert(false)).toThrow(new Error("Failed assertion"));
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
        // tslint:disable-next-line: array-type
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
            }
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
            }
        ).should.be.true;
    });

    it("throw error for wrong types", () => {
        expect(() => assertType("undefined", { b: null })).toThrow(
            expect.error(
                "Expected b to be of type 'undefined', instead got 'null'."
            )
        );
        expect(() => assertType("null", { b: undefined })).toThrow(
            expect.error(
                "Expected b to be of type 'null', instead got 'undefined'."
            )
        );
        expect(() => assertType("Buffer | string", { b: 1 })).toThrow(
            expect.error(
                "Expected b to be of type 'Buffer | string', instead got 'number'."
            )
        );
        expect(() =>
            assertType("Buffer | string | undefined", { d: null })
        ).toThrow(
            expect.error(
                "Expected d to be of type 'Buffer | string | undefined', instead got 'null'."
            )
        );
        expect(() =>
            assertType("Array<number>", {
                a: [1, 2, "a"],
            })
        ).toThrow(
            expect.error(
                "Expected a[2] to be of type 'number', instead got 'string'."
            )
        );

        expect(() =>
            assertType("string | number[]", {
                a: ["1", "2", "3"],
            })
        ).toThrow(
            expect.error(
                "Expected a to be of type 'string | number[]', instead got 'any[]'."
            )
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
                }
            )
        ).toThrow(
            expect.error(
                "Expected a[\"first\"][\"innerFirst\"] to be of type 'number', instead got 'string'."
            )
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
                }
            )
        ).toThrow(
            expect.error(
                "Expected a[\"first\"] to be of type 'number', instead got 'string'."
            )
        );
    });

    it("edge cases", () => {
        expect(assertType("number", { v: 1 })).toEqual(true);
        expect(assertType("Array<number>", { v: [1] })).toEqual(true);
        expect(assertType("number[]", { v: [1] })).toEqual(true);

        expect(() =>
            assertObject(
                {
                    first: null,
                },
                {
                    a: {
                        first: [],
                    },
                }
            )
        ).toThrow(expect.error("Cannot convert undefined or null to object"));

        expect(() =>
            assertObject(
                {
                    first: undefined,
                },
                {
                    a: {
                        first: [],
                    },
                }
            )
        ).toThrow(expect.error("Invalid object type definition undefined"));
    });
});
