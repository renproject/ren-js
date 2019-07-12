import chai from "chai";
import { EventEmitter } from "events";

import { forwardEvents, newPromiEvent, PromiEvent } from "../../src/lib/promievent";
import { sleep } from "../../src/lib/utils";

require("dotenv").config();

chai.use(require("chai-bignumber")(require("bignumber.js")));
chai.should();

const waitForEvent = async <T>(promiEvent: PromiEvent<T>, event: string) => new Promise((resolve) => {
    promiEvent.on(event, resolve);
});

const createPromiEvent = <T>(value: T, event = "value") => {
    const promiEvent = newPromiEvent<T>();
    (async () => {

        // Yield to the task switcher
        await sleep(0);

        promiEvent.emit(event, value);
        promiEvent.resolve(value);
    })().catch(promiEvent.reject);
    return promiEvent;
};

describe("promievent.ts", () => {
    it("Can emit an event", async () => {

        const promiEvent = createPromiEvent(1);

        (await waitForEvent<number>(promiEvent, "value"))
            .should.equal(1);

        (await promiEvent)
            .should.equal(1);
    });

    it("Can listen and await", async () => {
        (await new Promise((resolve) => createPromiEvent(1).on("value", resolve)))
            .should.equal(1);
    });

    it("Can forward events", async () => {
        const promiEvent1 = createPromiEvent(1, "transactionHash");
        const promiEvent2 = createPromiEvent(2, "receipt");

        forwardEvents(promiEvent1, promiEvent2);

        const firstEvent = waitForEvent<number>(promiEvent1, "transactionHash");
        const secondEvent = waitForEvent<number>(promiEvent2, "receipt");
        const thirdEvent = waitForEvent<number>(promiEvent2, "transactionHash");

        (await firstEvent).should.equal(1);
        (await secondEvent).should.equal(2);
        (await thirdEvent).should.equal(1);
    });

    it("Can forward events (2)", async () => {
        const promiEvent1 = createPromiEvent(1, "transactionHash");

        (async () => {
            const promiEvent2 = createPromiEvent(2, "receipt");

            forwardEvents(promiEvent1, promiEvent2);

            promiEvent2.emit("transactionHash", 1);

            return 1;
        })().then(promiEvent1.resolve).catch(promiEvent1.reject);

        const firstEvent = waitForEvent<number>(promiEvent1, "transactionHash");

        (await firstEvent).should.equal(1);
        (await promiEvent1).should.equal(1);
    });
});
