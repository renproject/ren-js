import { RenNetwork } from "@renproject/interfaces";
import { AbstractEthereumConnector } from "@renproject/multiwallet-abstract-ethereum-connector";
import { ConnectorInterface } from "@renproject/multiwallet-base-connector";
// import MEWConnect from "@myetherwallet/mewconnect-web-client";

export interface EthereumConnectorOptions {
    debug: boolean;
    rpc: { [chainId: number]: string };
    chainId: number;
}

export class EthereumMEWConnectConnector extends AbstractEthereumConnector {
    private readonly rpc: { [chainId: number]: string };
    private readonly chainId: number;

    private provider?: any; //MEWConnect.Provider;
    supportsTestnet = false;
    constructor(options: EthereumConnectorOptions) {
        super(options);
        this.chainId = options.chainId;
        this.rpc = options.rpc;
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

        await provider.enable().catch((error: Error): void => {
            // TODO ideally this would be a better check
            if (error.message === "User closed modal") {
                this.emitter.emitError(new Error("User rejected request"));
            }

            throw error;
        });

        provider.on("close", this.deactivate);
        provider.on("networkChanged", this.handleUpdate);
        provider.on("accountsChanged", this.handleUpdate);
        provider.on("chainChanged", this.handleUpdate);
        return this.getStatus();
    };

    getProvider = async () => {
        if (this.provider) return this.provider as any;
        const { Provider } = await import(
            "@myetherwallet/mewconnect-web-client"
        ).then((m) => m?.default ?? m);
        const mewConnectProvider = new Provider({
            windowClosedError: true,
        }) as any;
        this.provider = mewConnectProvider.makeWeb3Provider(
            this.chainId,
            this.rpc[this.chainId],
            true
        );
        return this.provider;
    };

    // Get default web3 account
    async getAccount() {
        return (await this.getProvider())
            .send("eth_accounts")
            .then((accounts: string[]): string => accounts[0]);
    }
    // Cast current ethereum network to Ren network version or throw
    async getRenNetwork(): Promise<RenNetwork> {
        if (!this.provider) throw new Error("not initialized");
        return this.networkIdMapper(await this.provider.send("eth_chainId"));
    }

    deactivate = async (reason?: string) => {
        const provider: any = await this.getProvider();
        provider.removeListener("close", this.deactivate);
        provider.removeListener("networkChanged", this.handleUpdate);
        provider.removeListener("accountsChanged", this.handleUpdate);
        provider.removeListener("chainChanged", this.handleUpdate);
        await provider.close();
        return this.emitter.emitDeactivate(reason);
    };
}
