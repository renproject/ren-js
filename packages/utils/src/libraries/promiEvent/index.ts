/**
 * @file PromiEvent.js
 * @author Fabian Vogelsteller <fabian@ethereum.org>, Samuel Furter <samuel@ethereum.org>
 * 2018
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { EventEmitter } from "events";

import { EventEmitterTyped } from "../../types/eventEmitter";

/** PromiEvent implementation, modified from the Web3 PromiEvent. */
export class Web3PromiEvent<
    T,
    // eslint-disable-next-line @typescript-eslint/ban-types
    EventTypes extends { [event: string]: any[] } = {},
> extends EventEmitterTyped<EventTypes> {
    public readonly [Symbol.toStringTag]: "Promise" = "Promise";
    public readonly promise: Promise<T>;
    // @ts-ignore no initializer because of proxyHandler
    public resolve: (value: T | PromiseLike<T>) => void;
    // @ts-ignore no initializer because of proxyHandler
    public reject: (reason?: any) => void;
    public eventEmitter: EventEmitterTyped<EventTypes>;
    private _cancelled: boolean;

    // @ts-ignore no initializer because of proxyHandler
    public readonly emit: <Event extends keyof EventTypes>(
        event: Event,
        ...args: EventTypes[Event]
    ) => boolean; // EventEmitter["emit"]
    // @ts-ignore no initializer because of proxyHandler
    public readonly removeListener: EventEmitter["removeListener"];
    // @ts-ignore no initializer because of proxyHandler
    public readonly on: <Event extends keyof EventTypes>(
        event: Event,
        callback: (...values: EventTypes[Event]) => void | Promise<void>,
    ) => this;
    // @ts-ignore no initializer because of proxyHandler
    public readonly once: <Event extends keyof EventTypes>(
        event: Event,
        callback: (...values: EventTypes[Event]) => void | Promise<void>,
    ) => this;
    // @ts-ignore no initializer because of proxyHandler
    public readonly listenerCount: (event: string | symbol) => number;
    // @ts-ignore no initializer because of proxyHandler
    public readonly _cancel: () => void;
    // @ts-ignore no initializer because of proxyHandler
    public readonly _resume: () => void;
    // @ts-ignore no initializer because of proxyHandler
    public readonly _isCancelled: () => boolean;
    // @ts-ignore no initializer because of proxyHandler
    public readonly then: Promise<T>["then"];
    // @ts-ignore no initializer because of proxyHandler
    public readonly catch: Promise<T>["catch"];
    // @ts-ignore no initializer because of proxyHandler
    public readonly finally: Promise<T>["finally"];

    /**
     * Sets up the event emitter and the promise, as well as a proxy handler
     * for routing method calls to the promise or event emitter.
     */
    public constructor(eventEmitter?: EventEmitterTyped<EventTypes>) {
        super();
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });

        this._cancelled = false;

        this.eventEmitter =
            eventEmitter ||
            (new EventEmitter() as unknown as EventEmitterTyped<EventTypes>);

        return new Proxy(this, {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            get: this.proxyHandler,
        });
    }

    /**
     * Proxy handler to call the promise or eventEmitter methods
     */
    public proxyHandler = (
        target: Web3PromiEvent<T, EventTypes>,
        name: string,
    ): unknown => {
        if (name === "resolve" || name === "reject") {
            // eslint-disable-next-line security/detect-object-injection
            return target[name];
        }

        if (name === "then") {
            return target.promise.then.bind(target.promise);
        }

        if (name === "catch") {
            return target.promise.catch.bind(target.promise);
        }

        if (name === "_cancel") {
            return () => {
                this._cancelled = true;
            };
        }

        if (name === "_isCancelled") {
            return () => this._cancelled === true;
        }

        if (name === "_resume") {
            return () => {
                this._cancelled = false;
            };
        }

        // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-unsafe-member-access
        if ((target.eventEmitter as any)[name]) {
            // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-unsafe-member-access
            return (target.eventEmitter as any)[name];
        }

        return;
    };
}
