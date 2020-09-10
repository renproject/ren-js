import chai from "chai";
import { expect } from "earljs";

import { assertObject, assertType } from "../src/assert";

chai.should();
require("dotenv").config();

describe("assert", () => {
    it("undefined", () => {
        expect(assertType("undefined", { a: undefined })).toEqual(true);
        expect(() => assertType("undefined", { b: null })).toThrow(
            expect.error(
                "Expected b to be of type 'undefined', instead got 'null'."
            )
        );
    });

    it("null", () => {
        expect(assertType("null", { a: null })).toEqual(true);
        expect(() => assertType("null", { b: undefined })).toThrow(
            expect.error(
                "Expected b to be of type 'null', instead got 'undefined'."
            )
        );
    });

    it("union type", () => {
        const buffer = Buffer.from([]);

        expect(assertType("Buffer | string", { a: buffer })).toEqual(true);
        expect(assertType("Buffer | string", { b: "1" })).toEqual(true);
        expect(() => assertType("Buffer | string", { b: 1 })).toThrow(
            expect.error(
                "Expected b to be of type 'Buffer | string', instead got 'number'."
            )
        );
        expect(
            assertType("Buffer | string | undefined", { c: undefined })
        ).toEqual(true);
        expect(() =>
            assertType("Buffer | string | undefined", { d: null })
        ).toThrow(
            expect.error(
                "Expected d to be of type 'Buffer | string | undefined', instead got 'null'."
            )
        );
    });

    it("array", () => {
        expect(
            assertType("number[]", {
                a: [1, 2, 3],
            })
        ).toEqual(true);

        expect(
            assertType("Array<number>", {
                a: [1, 2, 3],
            })
        ).toEqual(true);

        expect(() =>
            assertType("Array<number>", {
                a: [1, 2, "a"],
            })
        ).toThrow(
            expect.error(
                "Expected a[2] to be of type 'number', instead got 'string'."
            )
        );
    });

    it("array union type", () => {
        expect(
            assertType("number | number[]", {
                a: [1, 2, 3],
            })
        ).toEqual(true);

        expect(
            assertType("number | number[]", {
                a: 1,
            })
        ).toEqual(true);

        expect(
            assertType("string[] | number[]", {
                a: [1, 2, 3],
            })
        ).toEqual(true);

        expect(
            assertType("string[] | number[]", {
                a: ["1", "2", "3"],
            })
        ).toEqual(true);

        expect(() =>
            assertType("string | number[]", {
                a: ["1", "2", "3"],
            })
        ).toThrow(
            expect.error(
                "Expected a to be of type 'string | number[]', instead got 'any[]'."
            )
        );
    });

    it("objects", () => {
        expect(
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
            )
        ).toEqual(true);

        expect(
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
            )
        ).toEqual(true);

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
});
