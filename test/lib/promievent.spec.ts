import chai from "chai";

import { newPromiEvent, PromiEvent } from "../../src/promievent";

require("dotenv").config();

chai.use(require("chai-bignumber")(require("bignumber.js")));
chai.should();

// tslint:disable-next-line: no-string-based-set-timeout
const sleep = async (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
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

describe("PromiEvent", () => {
    it("", async () => {

        const promiEvent = createPromiEvent(1);

        await waitForEvent(promiEvent, "value");

        (await promiEvent)
            .should.equal(1);
    });
});
