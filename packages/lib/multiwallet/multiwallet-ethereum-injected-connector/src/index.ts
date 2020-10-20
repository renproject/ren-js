import { AbstractEthereumConnector } from "@renproject/multiwallet-abstract-ethereum-connector";
import { ConnectorInterface } from "@renproject/multiwallet-base-connector";

export interface EthereumConnectorOptions {
    debug: boolean;
}

const isResults = <T>(x: { results: T } | T): x is { results: T } =>
    (x as { results: T }).results !== undefined;

const resultOrRaw = <T>(x: { results: T } | T) => {
    if (isResults(x)) {
        return x.results;
    }
    return x;
};

export class EthereumInjectedConnector extends AbstractEthereumConnector {
    supportsTestnet = true;
    constructor(options: EthereumConnectorOptions) {
        super(options);
    }
    handleUpdate = () =>
        this.getStatus()
            .then((...args) => this.emitter.emitUpdate(...args))
            .catch((...args) => this.deactivate(...args));

    activate: ConnectorInterface<any, any>["activate"] = async () => {
        // No good typings for injected providers exist...
        const provider: any = await this.getProvider();

        if (!provider) {
            throw Error("Missing Provider");
        }

        // clear all previous listeners
        await this.cleanup();

        if (provider.isMetamask) {
            // This behaviour is being deprecated so don't rely on it
            provider.autoRefreshOnNetworkChange = false;
        }

        let account;
        try {
            account = resultOrRaw(
                await provider.request({ method: "eth_requestAccounts" })
            )[0];
        } catch (error) {
            if ((error as any).code === 4001) {
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
        return window.ethereum;
    };

    cleanup = async () => {
        const provider: any = await this.getProvider();
        provider.removeListener("close", this.deactivate);
        provider.removeListener("networkChanged", this.handleUpdate);
        provider.removeListener("accountsChanged", this.handleUpdate);
        provider.removeListener("chainChanged", this.handleUpdate);
    };

    deactivate = async (reason?: string) => {
        await this.cleanup();
        return this.emitter.emitDeactivate(reason);
    };
}
