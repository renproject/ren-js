import { HistoryEvent } from "@renproject/ren-js-common";
import localForage from "localforage";

import { DEFAULT_NETWORK } from "../../lib/environmentVariables";

const stores = new Map<string, LocalForage>();

export const getURL = () => (window.location !== window.parent.location
    ? document.referrer
    : document.location.href);

const getStore = (network: string, domainIn: string) => {
    let storeName = (new URL(domainIn)).hostname;
    if (network !== DEFAULT_NETWORK) { storeName += `-${network}`; }
    let store = stores.get(storeName);
    if (store) { return store; }
    store = localForage.createInstance({
        name: storeName,
    });
    stores.set(storeName, store);
    return store;
};

export const getStorage = async (network: string, domainIn?: string): Promise<Map<string, HistoryEvent>> => {
    const domain = domainIn || getURL();

    const store = getStore(network, domain);

    const keys = await store.keys();

    const storage = new Map<string, HistoryEvent>();

    for (const key of keys) {
        storage.set(key, ((await store.getItem(key)) as HistoryEvent));
    }

    return storage;
};

const cancelled = new Set<string>();

export const updateStorageTrade = async (network: string, trade: HistoryEvent, domainIn?: string) => {
    const domain = domainIn || getURL();

    const store = getStore(network, domain);

    if (!cancelled.has(trade.shiftParams.nonce)) {
        await store.setItem(trade.shiftParams.nonce, trade);
    }

    return;
};

export const removeStorageTrade = async (network: string, nonce: string, domainIn?: string) => {
    const domain = domainIn || getURL();

    const store = getStore(network, domain);

    cancelled.add(nonce);
    await store.removeItem(nonce);

    return;
};
