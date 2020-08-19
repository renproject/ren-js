import { HistoryEvent } from "@renproject/interfaces";
import localForage from "localforage";
import { useCallback, useState } from "react";
import { createContainer } from "unstated-next";

import { DEFAULT_NETWORK } from "../lib/environmentVariables";

const stores = new Map<string, LocalForage>();

export const getURL = () =>
    // window.location !== window.parent.location
    document.referrer;
// : document.location.href;

export interface StorageProvider<K, V> {
    get: (key: K) => (V | undefined) | Promise<V | undefined>;
    set: (key: K, value: V) => V | Promise<V>;
    keys: () => K[] | Promise<K[]>;
}

export class LocalStorageProvider<V = HistoryEvent>
    implements StorageProvider<string, V> {
    private readonly store: LocalForage;

    constructor(network: string, domainIn?: string) {
        const domain = domainIn || getURL();
        let storeName = new URL(domain).hostname;
        if (network !== DEFAULT_NETWORK) {
            storeName += `-${network}`;
        }
        const localStorageKey = storeName;

        let store = stores.get(localStorageKey);
        if (!store) {
            store = localForage.createInstance({
                name: localStorageKey,
            });
            stores.set(localStorageKey, store);
        }
        this.store = store;
    }

    get = (k: string) => this.store.getItem<V>(k);
    set = async (k: string, v: V) => this.store.setItem(k, v);
    keys = () => this.store.keys();
}

export class MemoryProvider<K, V> implements StorageProvider<K, V> {
    private readonly store: Map<K, V>;

    constructor() {
        this.store = new Map<K, V>();
    }

    get = (k: K) => this.store.get(k);
    set = (k: K, v: V) => {
        this.store.set(k, v);
        return v;
    };
    keys = () => Array.from(this.store.keys());
}

const useTransferContainer = () => {
    const [network, setNetwork] = useState<string | undefined>();
    const [domain, setDomain] = useState<string | undefined>();

    const [store, setStore] = useState<
        StorageProvider<string, HistoryEvent> | undefined
    >();
    const [noLocalStorage, setNoLocalStorage] = useState(false);

    const connect = (networkIn: string, domainIn?: string) => {
        if (networkIn === network && domainIn === domain && store) {
            return store;
        }
        setNetwork(networkIn);
        setDomain(domainIn);
        let nextStore: StorageProvider<string, HistoryEvent>;
        try {
            nextStore = new LocalStorageProvider(networkIn, domainIn);
            setNoLocalStorage(false);
        } catch (error) {
            // Local storage not available.
            console.error(error);
            setNoLocalStorage(true);
            nextStore = new MemoryProvider();
        }
        setStore(nextStore);
        return nextStore;
    };

    const getTransfers = useCallback(async () => {
        let transfers = new Map<string, HistoryEvent>();
        if (store) {
            const keys = await store.keys();
            transfers = await keys.reduce(async (mapP, key) => {
                const map = await mapP;
                const transfer = await store.get(key);
                return transfer &&
                    transfer.transferParams &&
                    !transfer.archived &&
                    !transfer.returned
                    ? map.set(key, transfer)
                    : map;
            }, Promise.resolve(transfers));
        }
        return transfers;
    }, [store]);

    return {
        store,
        noLocalStorage,
        connect,
        getTransfers,
    };
};

export const TransferContainer = createContainer(useTransferContainer);
