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

// TODO: add handleSuccess() and handleError() method instead of having them in the send method class
class InternalPromiEvent<T> {
    public promise: Promise<T>;
    // @ts-ignore
    public resolve: (value?: T) => void;
    // @ts-ignore
    // tslint:disable-next-line: no-any
    public reject: (reason?: any) => void;
    public eventEmitter: EventEmitter;

    // @ts-ignore
    // tslint:disable-next-line: no-any
    public emit: (event: string, ...values: any[]) => void;
    // @ts-ignore
    // tslint:disable-next-line: no-any
    public on: (event: string, callback: (...values: any[]) => void | Promise<void>) => void;

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
     *
     * @method proxyHandler
     *
     * @param {PromiEvent} target
     * @param {String|Symbol} name
     *
     * @returns {Function}
     */
    // tslint:disable-next-line: no-any
    public proxyHandler(target: any, name: string) {
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
