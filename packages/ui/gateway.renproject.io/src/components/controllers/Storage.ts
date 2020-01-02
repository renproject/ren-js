import localForage from "localforage";

let stores = new Map<string, LocalForage>();

const getStore = (domainIn: string) => {
    const domain = (new URL(domainIn)).hostname;
    let store = stores.get(domain);
    if (store) { return store; }
    store = localForage.createInstance({
        name: domain
    });
    stores.set(domain, store);
    return store;
};

export const getStorage = async (domain: string): Promise<Map<string, {}>> => {
    const store = getStore(domain);

    const keys = await store.keys();

    const storage = new Map<string, {}>();

    for (const key of keys) {
        storage.set(key, await store.getItem(key));
    }

    return storage;
};

export const updateStorageTrade = async (domain: string, trade: {}) => {
    return;
};
