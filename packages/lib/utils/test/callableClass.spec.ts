import { expect } from "earljs";

import { Callable } from "../src/callableClass";

// @dev Removes any static fields, except `utils`.
const TestClass = Callable(
    class {
        public x: number;

        constructor() {
            this.x = 1;
        }
    },
);

describe("callableClass", () => {
    it("can be initialized without 'new'", () => {
        // With 'new'
        expect(new TestClass().x).toEqual(1);

        // Without 'new'
        expect(TestClass().x).toEqual(1);
    });
});
