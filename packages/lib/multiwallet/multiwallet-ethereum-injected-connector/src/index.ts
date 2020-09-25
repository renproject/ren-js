import { AbstractEthereumConnector } from "@renproject/multiwallet-abstract-ethereum-connector";

export interface EthereumConnectorOptions {
    debug: boolean;
}

export class EthereumInjectedConnector extends AbstractEthereumConnector {
    supportsTestnet = true;
    constructor(options: EthereumConnectorOptions) {
        super(options);
    }
    handleUpdate = () =>
        this.getStatus().then(this.emitter.emitUpdate).catch(this.deactivate);

    activate = async () => {
        // No good typings for injected providers exist...
        const provider: any = window.ethereum;
        if (!provider) {
            throw Error("Missing Provider");
        }
        await provider.enable();
        window.ethereum.on("close", this.deactivate);
        window.ethereum.on("networkChanged", this.handleUpdate);
        window.ethereum.on("accountsChanged", this.handleUpdate);
        window.ethereum.on("chainChanged", this.handleUpdate);
        return this.getStatus();
    };

    getProvider = () => {
        return window.ethereum;
    };

    deactivate = async (reason?: string) => {
        window.ethereum.removeListener("close", this.deactivate);
        window.ethereum.removeListener("networkChanged", this.handleUpdate);
        window.ethereum.removeListener("accountsChanged", this.handleUpdate);
        window.ethereum.removeListener("chainChanged", this.handleUpdate);
        return this.emitter.emitDeactivate(reason);
    };
}
