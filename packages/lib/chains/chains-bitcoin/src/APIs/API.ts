import { Callable } from "@renproject/utils";
import BigNumber from "bignumber.js";
import { AxiosError } from "axios";

export interface UTXO {
    readonly txHash: string; // hex string without 0x prefix
    readonly vOut: number;
    readonly amount: string; // in sats
    readonly confirmations: number;
}

export interface BitcoinAPI {
    fetchUTXO?: (txHash: string, vOut: number) => Promise<UTXO>;
    fetchUTXOs?: (address: string, confirmations?: number) => Promise<UTXO[]>;
    fetchTXs?: (address: string, confirmations?: number) => Promise<UTXO[]>;
    broadcastTransaction?: (hex: string) => Promise<string>;
}

// Default timeout for network requests.
const SECONDS = 1000;
export const DEFAULT_TIMEOUT = 30 * SECONDS;

/**
 * sortUTXOs compares two UTXOs by amount, then confirmations and then hash.
 *
 * @example
 * sortUTXOs({amount: 1, confirmations: 1}, {amount: 2, confirmations: 0});
 * // -1, representing that the first parameter should be ordered first.
 *
 * @returns a negative value to represent that a should come before b or a
 * positive value to represent that b should come before a.
 */
export const sortUTXOs = (a: UTXO, b: UTXO): number => {
    const aAmount = new BigNumber(a.amount);
    const bAmount = new BigNumber(b.amount);
    // Sort greater values first.
    return !aAmount.isEqualTo(bAmount)
        ? bAmount.minus(aAmount).toNumber()
        : // If the UTXOs have the same value, sort by number of confirmations.
        a.confirmations !== b.confirmations
        ? a.confirmations - b.confirmations
        : // Fallback so sorting by txHash alphabetically.
        a.txHash <= b.txHash
        ? -1
        : 1;
};

/**
 * fixValue turns a readable value, e.g. `0.0001` BTC, to the value in the smallest
 * unit, e.g. `10000` sats.
 *
 * @example
 * fixValue(0.0001, 8) = 10000;
 *
 * @param value Value in the readable representation, e.g. `0.0001` BTC.
 * @param decimals The number of decimals to shift by, e.g. 8.
 */
export const fixValue = (
    value: BigNumber | string | number,
    decimals: number,
): BigNumber =>
    new BigNumber(value)
        .multipliedBy(new BigNumber(10).exponentiatedBy(decimals))
        .decimalPlaces(0);

/**
 * fixUTXO calls {{fixValue}} on the value of the UTXO.
 */
export const fixUTXO = (utxo: UTXO, decimals: number): UTXO => ({
    ...utxo,
    amount: fixValue(utxo.amount, decimals).toFixed(),
});

/**
 * fixUTXOs maps over an array of UTXOs and calls {{fixValue}}.
 */
export const fixUTXOs = (utxos: readonly UTXO[], decimals: number) =>
    utxos.map((utxo) => fixUTXO(utxo, decimals));

export interface APIWithPriority {
    api: BitcoinAPI;
    priority: number;
}

const notNull = <T>(x: T | undefined | null): T => {
    if (x === undefined || x === null) {
        throw new Error(`Unexpected ${String(x)} value.`);
    }
    return x;
};

const withPriority = (api: BitcoinAPI | APIWithPriority, defaultPriority = 0) =>
    (api as APIWithPriority).api &&
    (api as APIWithPriority).priority !== undefined
        ? (api as APIWithPriority)
        : { api: api as BitcoinAPI, priority: defaultPriority };

export class CombinedAPIClass implements BitcoinAPI {
    apis: APIWithPriority[];

    constructor(
        apis: Array<BitcoinAPI | APIWithPriority> = [],
        { priority = 0 } = {},
    ) {
        this.apis = apis.map((api) => withPriority(api, priority));
    }

    /**
     * Provide a new API to be used with the other APIs.
     * @param api
     * @param { priority } Optionally set the priority of the API, where a lower
     * priority means it will be selected before other APIs.
     */
    public withAPI = (
        api: BitcoinAPI | APIWithPriority,
        { priority = 0 } = {},
    ) => {
        this.apis.push(withPriority(api, priority));
        return this;
    };

    public fetchUTXO = async (txHash: string, vOut: number): Promise<UTXO> =>
        this.forEachAPI(
            // Filter APIs with `fetchUTXO`.
            (api) => api.fetchUTXO !== undefined,
            // Call `fetchUTXO` on the API.
            async (api) => notNull(api.fetchUTXO)(txHash, vOut),
        );

    public fetchUTXOs = async (
        address: string,
        confirmations?: number,
    ): Promise<UTXO[]> =>
        this.forEachAPI(
            // Filter APIs with `fetchUTXOs`.
            (api) => api.fetchUTXOs !== undefined,
            // Call `fetchUTXOs` on the API.
            async (api) => notNull(api.fetchUTXOs)(address, confirmations),
        );

    public fetchTXs = async (
        address: string,
        confirmations?: number,
    ): Promise<UTXO[]> =>
        this.forEachAPI(
            // Filter APIs with `fetchTXs`.
            (api) => api.fetchTXs !== undefined,
            // Call `fetchTXs` on the API.
            async (api) => notNull(api.fetchTXs)(address, confirmations),
        );

    public broadcastTransaction = async (hex: string): Promise<string> =>
        this.forEachAPI(
            // Filter APIs with `broadcastTransaction`.
            (api) => api.broadcastTransaction !== undefined,
            // Call `broadcastTransaction` on the API.
            async (api) => notNull(api.broadcastTransaction)(hex),
        );

    private forEachAPI = async <T>(
        filter: (api: BitcoinAPI) => boolean,
        onAPI: (api: BitcoinAPI) => Promise<T>,
    ) => {
        const apis = this.apis
            .map((api, index) => ({ api, index }))
            .filter(({ api }) => filter(api.api))
            .sort(({ api: a }, { api: b }) =>
                // Sort by priority, and randomly for the same priority.
                a.priority !== b.priority
                    ? a.priority - b.priority
                    : Math.random() * 2 - 1,
            );

        if (!apis.length) {
            throw new Error(`No API available for call.`);
        }

        let firstError: Error | undefined;
        const previousIndices = [];
        for (const { api, index } of apis) {
            try {
                const result = await onAPI(api.api);

                // If any previous API failed, it may be down or rate limited,
                // so its priority is reduced.
                for (const previousIndex of previousIndices) {
                    this.apis[previousIndex].priority -= 5;
                }
                return result;
            } catch (error) {
                previousIndices.push(index);
                firstError = firstError || error;
            }
        }
        throw firstError;
    };
}

// @dev Removes any static fields.
export type CombinedAPI = CombinedAPIClass;
export const CombinedAPI = Callable(CombinedAPIClass);
