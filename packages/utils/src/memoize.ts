import { OrderedMap, Record } from "immutable";

import { MINUTES } from "./common";

/**
 * Cache the result of an asynchronous function, with a default expiry of 5
 * minutes. Only one result is stored at a time.
 */
export const memoize = <Params extends any[], Result>(
    fn: (...params: Params) => Promise<Result>,
    { expiry = (5 * MINUTES) as number | false, entryLimit = 100 } = {
        expiry: (5 * MINUTES) as number | false,
        entryLimit: 100,
    },
): ((...params: Params) => Promise<Result>) => {
    interface CacheRecordInner {
        timestamp: number;
        paramKey: string;
        result: Result;
    }

    const CacheRecord = Record<CacheRecordInner>({
        timestamp: 0,
        paramKey: null as never,
        result: null as never,
    });

    let cacheMap = OrderedMap<string, Record<CacheRecordInner>>();

    return async (...params: Params): Promise<Result> => {
        const paramKey = JSON.stringify(params);
        const cachedResult = cacheMap.get(paramKey);
        const currentTime = Date.now() / 1000;
        if (
            cachedResult &&
            (expiry === false ||
                currentTime - cachedResult.get("timestamp") < expiry) &&
            cachedResult.get("paramKey") === paramKey
        ) {
            return cachedResult.get("result");
        } else {
            const result = await fn(...params);

            // Update cache
            cacheMap = cacheMap.set(
                paramKey,
                CacheRecord({
                    timestamp: Date.now() / 1000,
                    paramKey,
                    result,
                }),
            );
            if (cacheMap.size > entryLimit) {
                cacheMap = cacheMap.slice(-entryLimit);
            }

            return result;
        }
    };
};
