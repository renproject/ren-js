import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";

require("dotenv").config();

chai.use((chaiBigNumber)(BigNumber));
chai.should();

describe("Test template", function () {
    // Disable test timeout.
    this.timeout(0);

    before(async () => {
        // Setup before tests
    });

    it("Test", async () => {
        // Run a test
    });
});
