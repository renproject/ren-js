import {
    AbstractEthereumConnector,
    SaneProvider,
    AbstractEthereumConnectorOptions,
} from "@renproject/multiwallet-abstract-ethereum-connector";
import { ConnectorInterface } from "@renproject/multiwallet-base-connector";
import { SyncOrPromise } from "@renproject/interfaces";

export interface EthereumConnectorOptions
    extends AbstractEthereumConnectorOptions {
    debug: boolean;
}

// No good typings for injected providers exist.
export type InjectedProvider = SaneProvider & {
    isMetamask?: boolean;
    autoRefreshOnNetworkChange?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request: (request: { method: string }) => Promise<any>;
    enable: () => Promise<void>;
    on: (
        name: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        listener: (...args: any[]) => SyncOrPromise<void>,
    ) => void;
};

const isResults = <T>(x: { results: T } | T): x is { results: T } =>
    (x as { results: T }).results !== undefined;

const resultOrRaw = <T>(x: { results: T } | T) => {
    if (isResults(x)) {
        return x.results;
    }
    return x;
};

export class EthereumInjectedConnector extends AbstractEthereumConnector<InjectedProvider> {
    supportsTestnet = true;
    constructor(options: EthereumConnectorOptions) {
        super(options);
    }
    handleUpdate = () => {
        this.getStatus()
            .then((...args) => {
                this.emitter.emitUpdate(...args);
            })
            .catch(async (...args) => this.deactivate(...args));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activate: ConnectorInterface<any, any>["activate"] = async () => {
        // Await in case a child class's getProvider is asynchronous.
        const provider = await (
            this as AbstractEthereumConnector<InjectedProvider>
        ).getProvider();

        if (!provider) {
            throw Error("Missing Provider");
        }

        // clear all previous listeners
        await this.cleanup();

        if (provider.isMetamask) {
            // This behavior is being deprecated so don't rely on it
            provider.autoRefreshOnNetworkChange = false;
        }

        let account;
        try {
            account = resultOrRaw(
                await provider.request({ method: "eth_requestAccounts" }),
            )[0];
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (error.code === 4001) {
                this.emitter.emitError(new Error("User rejected request"));
            }
            console.error(error);
        }

        // if unsuccessful, try enable
        if (!account) {
            account = resultOrRaw(await provider.enable())[0];
        }
        provider.on("close", this.deactivate);
        provider.on("networkChanged", this.handleUpdate);
        provider.on("accountsChanged", this.handleUpdate);
        provider.on("chainChanged", this.handleUpdate);
        return this.getStatus();
    };

    getProvider = () => {
        return window.ethereum as InjectedProvider;
    };

    cleanup = async () => {
        // Await in case a child class's getProvider is asynchronous.
        const provider = await (
            this as AbstractEthereumConnector<InjectedProvider>
        ).getProvider();
        if (provider.removeListener) {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            provider.removeListener("close", this.deactivate);
            provider.removeListener("networkChanged", this.handleUpdate);
            provider.removeListener("accountsChanged", this.handleUpdate);
            provider.removeListener("chainChanged", this.handleUpdate);
        }
    };

    deactivate = async (reason?: string) => {
        await this.cleanup();
        this.emitter.emitDeactivate(reason);
    };
}
