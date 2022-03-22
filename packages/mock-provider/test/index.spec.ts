import { expect } from "chai";

import { MockProvider, MockChain } from "../src";

describe("@renproject/mock-provider", () => {
    it("should export MockProvider and MockChain correctly", async () => {
        expect(MockProvider).not.to.equal(undefined);
        expect(MockChain).not.to.equal(undefined);
    });
});
