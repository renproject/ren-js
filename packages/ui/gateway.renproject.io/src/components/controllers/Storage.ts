import { HistoryEvent } from "@renproject/interfaces";
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

export const getStorageItem = async (network: string, nonce: string, domainIn?: string): Promise<HistoryEvent> => {
    const domain = domainIn || getURL();

    const store = getStore(network, domain);

    return await store.getItem(nonce);
};

const cancelled = new Set<string>();

export const updateStorageTransfer = async (network: string, historyEvent: HistoryEvent, domainIn?: string) => {
    const domain = domainIn || getURL();

    const store = getStore(network, domain);

    if (!historyEvent.transferParams.nonce) {
        throw new Error(`Transfer must have nonce`);
    }

    if (!cancelled.has(historyEvent.transferParams.nonce)) {
        await store.setItem(historyEvent.transferParams.nonce, historyEvent);
    }

    return;
};

export const removeStorageTransfer = async (network: string, nonce: string, domainIn?: string) => {
    const domain = domainIn || getURL();

    const store = getStore(network, domain);

    cancelled.add(nonce);
    await store.removeItem(nonce);

    return;
};
