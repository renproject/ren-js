import { Record } from "immutable";

import { isDefined, MINUTES } from "@renproject/utils";

const shallowEqualityCheck = (left: any[], right: any[]): boolean => {
    if (left.length !== right.length) {
        return false;
    }
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) {
            return false;
        }
    }
    return true;
};

/**
 * Cache the result of an asynchronous function, with a default expiry of 5
 * minutes. Only one result is stored at a time.
 */
export const memoize = <Params extends any[], Result>(
    fn: (...params: Params) => Promise<Result>,
    {
        expiry = 5 * MINUTES,
    }: {
        expiry: number;
    } = { expiry: 5 * MINUTES },
): ((...params: Params) => Promise<Result>) => {
    interface CacheRecordInner {
        timestamp: number;
        params: Params;
        result: Result;
    }

    const CacheRecord = Record<CacheRecordInner>({
        timestamp: 0,
        params: null as never,
        result: null as never,
    });

    // const expiry = config && isDefined(config.expiry) ? config.expiry :

    let cache: Record<CacheRecordInner> | undefined;

    return async (...params: Params): Promise<Result> => {
        const latestCache = cache;
        const currentTime = Date.now() / 1000;
        if (
            latestCache &&
            currentTime - latestCache.get("timestamp") < expiry &&
            shallowEqualityCheck(latestCache.get("params"), params)
        ) {
            return latestCache.get("result");
        } else {
            const result = await fn(...params);

            // Update cache
            cache = CacheRecord({
                timestamp: Date.now() / 1000,
                params,
                result,
            });

            return result;
        }
    };
};
