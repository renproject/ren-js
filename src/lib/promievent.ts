// Modified from web3-core-method

/*
    This file is part of web3.js.

    web3.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    web3.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
*/
/**
 * @file PromiEvent.js
 * @author Fabian Vogelsteller <fabian@ethereum.org>, Samuel Furter <samuel@ethereum.org>
 * @date 2018
 */

import { EventEmitter } from "events";
import { TransactionReceipt } from "web3-core";

class InternalPromiEvent<T> {
    public readonly [Symbol.toStringTag]: "Promise";
    public readonly promise: Promise<T>;
    // @ts-ignore no initializer because of proxyHandler
    public resolve: (value?: T) => void;
    // @ts-ignore no initializer because of proxyHandler
    // tslint:disable-next-line: no-any
    public reject: (reason?: any) => void;
    public eventEmitter: EventEmitter;

    // @ts-ignore no initializer because of proxyHandler
    public readonly emit: EventEmitter["emit"];
    // @ts-ignore no initializer because of proxyHandler
    public readonly removeListener: EventEmitter["removeListener"];
    // @ts-ignore no initializer because of proxyHandler
    // tslint:disable-next-line: no-any
    public readonly on: (event: string, callback: (...values: any[]) => void | Promise<void>) => this;
    // @ts-ignore no initializer because of proxyHandler
    // tslint:disable-next-line: no-any
    public readonly once: (event: string, callback: (...values: any[]) => void | Promise<void>) => this;
    // @ts-ignore no initializer because of proxyHandler
    public readonly then: Promise<T>["then"];
    // @ts-ignore no initializer because of proxyHandler
    public readonly catch: Promise<T>["catch"];
    // @ts-ignore no initializer because of proxyHandler
    public readonly finally: Promise<T>["finally"];

    /**
     * @constructor
     */
    constructor() {
        // tslint:disable-next-line: promise-must-complete
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });

        this.eventEmitter = new EventEmitter();

        return new Proxy(this, {
            get: this.proxyHandler
        });
    }

    /**
     * Proxy handler to call the promise or eventEmitter methods
     */
    public proxyHandler(target: PromiEvent<T>, name: string) {
        if (name === "resolve" || name === "reject") {
            return target[name];
        }

        if (name === "then") {
            return target.promise.then.bind(target.promise);
        }

        if (name === "catch") {
            return target.promise.catch.bind(target.promise);
        }

        if (target.eventEmitter[name]) {
            return target.eventEmitter[name];
        }
    }
}

// Tell Typescript that InternalPromiEvent<T> implements Promise<T>.
export type PromiEvent<T> = InternalPromiEvent<T> & Promise<T>;
export const newPromiEvent = <T>() => new InternalPromiEvent<T>() as PromiEvent<T>;

export const forwardEvents = <T, Y>(src: PromiEvent<T>, dest: PromiEvent<Y>, filterFn = (_name: string) => true) => {
    // // tslint:disable-next-line: no-any
    // const forwardEmitterNewListener = (eventName: string, listener: (...args: any[]) => void) => {
    //     if (filterFn(eventName) && listener.name.indexOf("__forward_emitter_") !== 0) {
    //         console.log(`Forwarding ${eventName}!!! Listener:`);
    //         console.log(listener);
    //         src.on(eventName, listener);
    //         src.on("transactionHash", (txHash) => { console.log(`Got transaction hash on src`); });
    //     } else {
    //         console.log("Can't forward PromiEvent event!");
    //     }
    // };

    // // tslint:disable-next-line: no-any
    // const forwardEmitterRemoveListener = (eventName: string, listener: (...args: any[]) => void) => {
    //     src.removeListener(eventName, listener);
    // };

    // // Listeners bound to the destination emitter should be bound to the source emitter.
    // dest.on("newListener", forwardEmitterNewListener);

    // // When a listener is removed from the destination emitter, remove it from the source emitter
    // // (otherwise it will continue to be called).
    // dest.on("removeListener", forwardEmitterRemoveListener);

    // Until the above is fixed, we manually forward each event name:
    src.on("transactionHash", (eventReceipt: string) => { dest.emit("transactionHash", eventReceipt); });
    src.on("receipt", (eventReceipt: TransactionReceipt) => { dest.emit("receipt", eventReceipt); });
    src.on("confirmation", (confNumber: number, eventReceipt: TransactionReceipt) => { dest.emit("confirmation", confNumber, eventReceipt); });
    src.on("error", (error: Error) => { dest.emit("error", error); });
};
