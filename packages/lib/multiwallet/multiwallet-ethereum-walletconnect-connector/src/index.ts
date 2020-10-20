import { RenNetwork } from "@renproject/interfaces";
import { AbstractEthereumConnector } from "@renproject/multiwallet-abstract-ethereum-connector";
import { ConnectorInterface } from "@renproject/multiwallet-base-connector";
import WalletConnectProvider from "@walletconnect/web3-provider";

export interface EthereumConnectorOptions {
    debug: boolean;
    rpc: { [chainId: number]: string };
    bridge?: string;
    qrcode?: boolean;
    pollingInterval?: number;
}

export class EthereumWalletConnectConnector extends AbstractEthereumConnector {
    private readonly rpc: { [chainId: number]: string };
    private readonly bridge?: string;
    private readonly qrcode?: boolean;
    private readonly pollingInterval?: number;

    private provider?: WalletConnectProvider;
    supportsTestnet = false;
    constructor(options: EthereumConnectorOptions) {
        super(options);
        this.bridge = options.bridge;
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

        if (!provider.wc.connected) {
            await provider.wc.createSession({
                chainId: Number(Object.keys(this.rpc)[0]),
            });
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
        const WalletConnectProvider = await import(
            "@walletconnect/web3-provider"
        ).then((m) => m?.default ?? m);
        this.provider = new WalletConnectProvider({
            bridge: this.bridge,
            rpc: this.rpc,
            qrcode: this.qrcode,
            pollingInterval: this.pollingInterval,
        }) as any;
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
