import { expect } from "chai";

import { Terra } from "../src";

describe("@renproject/chains-terra", () => {
    it("should export Terra correctly", async () => {
        expect(Terra).not.to.equal(undefined);
    });
});
