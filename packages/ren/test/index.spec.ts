import { expect } from "chai";

import RenJS from "../src";

describe("@renproject/ren", () => {
    it("should export RenJS correctly", async () => {
        expect(RenJS).not.to.equal(undefined);
    });
});
