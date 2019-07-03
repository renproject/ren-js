import chai from "chai";

import { newPromiEvent, PromiEvent } from "../../src/lib/promievent";
import { sleep } from "../../src/lib/utils";

require("dotenv").config();

chai.use(require("chai-bignumber")(require("bignumber.js")));
chai.should();

const waitForEvent = async <T>(promiEvent: PromiEvent<T>, event: string) => new Promise((resolve) => {
    promiEvent.on(event, resolve);
});

const createPromiEvent = <T>(value: T) => {
    const promiEvent = newPromiEvent<T>();
    (async () => {

        // Yield to the task switcher
        await sleep(0);

        promiEvent.emit("value", value);
        promiEvent.resolve(value);
    })().catch(promiEvent.reject);
    return promiEvent;
};

describe("promievent.ts", () => {
    it("Can emit an event", async () => {

        const promiEvent = createPromiEvent(1);

        await waitForEvent(promiEvent, "value");

        (await promiEvent)
            .should.equal(1);
    });

    it("Can listen and await", async () => {
        (await new Promise((resolve) => createPromiEvent(1).on("value", resolve)))
            .should.equal(1);
    });
});
