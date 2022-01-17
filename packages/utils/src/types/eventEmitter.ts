/* eslint-disable @typescript-eslint/ban-ts-comment */

import { EventEmitter } from "events";

import { Web3PromiEvent } from "../libraries/promiEvent";

/** Interface for EventEmitter with well-typed events. */
export class EventEmitterTyped<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EventTypes extends { [event: string]: any[] } = {},
> {
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
}

/** Create a new EventEmitterTyped */
export const eventEmitter = <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EventTypes extends { [event: string]: any[] } = {},
>(): EventEmitterTyped<EventTypes> =>
    new EventEmitter() as unknown as EventEmitterTyped<EventTypes>;

// Tell Typescript that Web3PromiEvent<T> implements Promise<T>.
export type PromiEvent<
    T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EventTypes extends { [event: string]: any[] } = {},
> = Web3PromiEvent<T, EventTypes> & Promise<T>;
