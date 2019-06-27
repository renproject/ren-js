// tslint:disable: no-any

import { EventEmitter } from "events";

export default class PromiEvent<T> extends Promise<T> {
    public readonly events: EventEmitter;
    public readonly [Symbol.toStringTag]: "Promise";

    public on: (event: string | symbol, listener: (...args: any[]) => void) => EventEmitter;

    constructor(executor: (
        resolve: (value?: T | PromiseLike<T>) => void,
        reject: (reason?: any) => void,
    ) => void) {
        // call the EventEmitter constructor
        super(executor);
        this.events = new EventEmitter();
        this.on = this.events.on;
    }
}
