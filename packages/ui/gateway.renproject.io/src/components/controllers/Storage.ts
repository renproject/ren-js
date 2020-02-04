import { HistoryEvent } from "@renproject/ren-js-common";
import localForage from "localforage";

const stores = new Map<string, LocalForage>();

export const getURL = () => (window.location !== window.parent.location
    ? document.referrer
    : document.location.href);

const getStore = (domainIn: string) => {
    const domain = (new URL(domainIn)).hostname;
    let store = stores.get(domain);
    if (store) { return store; }
    store = localForage.createInstance({
        name: domain,
    });
    stores.set(domain, store);
    return store;
};

export const getStorage = async (domainIn?: string): Promise<Map<string, HistoryEvent>> => {
    const domain = domainIn || getURL();

    const store = getStore(domain);

    const keys = await store.keys();

    const storage = new Map<string, HistoryEvent>();

    for (const key of keys) {
        storage.set(key, ((await store.getItem(key)) as HistoryEvent));
    }

    return storage;
};

const cancelled = new Set<string>();

export const updateStorageTrade = async (trade: HistoryEvent, domainIn?: string) => {
    const domain = domainIn || getURL();

    const store = getStore(domain);

    if (!cancelled.has(trade.shiftParams.nonce)) {
        await store.setItem(trade.shiftParams.nonce, trade);
    }

    return;
};

export const removeStorageTrade = async (nonce: string, domainIn?: string) => {
    const domain = domainIn || getURL();

    const store = getStore(domain);

    cancelled.add(nonce);
    await store.removeItem(nonce);

    return;
};
