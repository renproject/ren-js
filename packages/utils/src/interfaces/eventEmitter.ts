/* eslint-disable @typescript-eslint/ban-ts-comment */

import { EventEmitter } from "events";

/** Interface for EventEmitter with well-typed events. */
export class EventEmitterTyped<
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
