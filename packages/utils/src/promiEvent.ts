import { EventEmitterTyped } from "./interfaces/eventEmitter";
import { Web3PromiEvent } from "./libraries/promiEvent";

// Tell Typescript that Web3PromiEvent<T> implements Promise<T>.
export type PromiEvent<
    T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EventTypes extends { [event: string]: any[] } = {},
> = Web3PromiEvent<T, EventTypes> & Promise<T>;

/**
 * Helper function for creating new PromiEvents.
 */
export const newPromiEvent = <
    T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EventTypes extends { [event: string]: any[] } = {},
>(
    eventEmitter?: EventEmitterTyped<EventTypes>,
): PromiEvent<T, EventTypes> => new Web3PromiEvent<T, EventTypes>(eventEmitter);
