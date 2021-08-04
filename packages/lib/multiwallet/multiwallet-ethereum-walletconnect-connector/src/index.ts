/* eslint-disable no-console */

import { RenNetwork } from "@renproject/interfaces";
import {
    AbstractEthereumConnector,
    SaneProvider,
    AbstractEthereumConnectorOptions,
} from "@renproject/multiwallet-abstract-ethereum-connector";
import { ConnectorInterface } from "@renproject/multiwallet-base-connector";
import WalletConnectProvider from "@walletconnect/web3-provider";

export interface EthereumConnectorOptions
    extends AbstractEthereumConnectorOptions {
    debug?: boolean;
    rpc: { [chainId: number]: string };
    bridge?: string;
    qrcode?: boolean;
    pollingInterval?: number;
}

export type SaneWalletConnectProvider = WalletConnectProvider & SaneProvider;

export class EthereumWalletConnectConnector extends AbstractEthereumConnector<SaneWalletConnectProvider> {
    private readonly rpc: { [chainId: number]: string };
    private readonly bridge?: string;
    private readonly qrcode?: boolean;
    private readonly pollingInterval?: number;

    private provider?: SaneWalletConnectProvider;
    supportsTestnet = false;
    constructor(options: EthereumConnectorOptions) {
        super(options);
        this.bridge = options.bridge;
        this.rpc = options.rpc;
    }

    handleUpdate = () => {
        this.getStatus()
            .then((...args) => {
                this.emitter.emitUpdate(...args);
            })
            .catch((...args) => {
                console.error("Failed to get status");
                void this.deactivate(...args);
            });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activate: ConnectorInterface<any, any>["activate"] = async () => {
        if (this.debug) console.debug("activating");

        await this.cleanup();
        if (this.debug) console.debug("cleaned up old listeners");

        // No good typings for injected providers exist...
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const provider: any = await this.getProvider();
        if (this.debug) console.debug("got provider");
        if (!provider) {
            throw Error("Missing Provider");
        }

        if (!provider.wc.connected) {
            if (this.debug) console.debug("creating session");
            await provider.wc.createSession({
                chainId: Number(Object.keys(this.rpc)[0]),
            });
        }

        if (this.debug) console.debug("enabling");
        await provider.enable().catch((error: Error): void => {
            console.error(error);
            // TODO ideally this would be a better check
            if (error.message === "User closed modal") {
                this.emitter.emitError(new Error("User rejected request"));
            }

            throw error;
        });
        if (this.debug) console.debug("enabled");

        provider.on("close", this.deactivate);
        provider.on("networkChanged", this.handleUpdate);
        provider.on("accountsChanged", this.handleUpdate);
        provider.on("chainChanged", this.handleUpdate);
        return this.getStatus();
    };

    getProvider = async () => {
        if (this.debug) console.debug("getting provider");
        if (this.provider) return this.provider;

        if (this.debug) console.debug("getting module");
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const WalletConnectProvider = await import(
            "@walletconnect/web3-provider"
        ).then((m) => (m ? m.default || m : m));

        if (this.debug) console.debug("building provider");
        this.provider = new WalletConnectProvider({
            bridge: this.bridge,
            rpc: this.rpc,
            qrcode: this.qrcode,
            pollingInterval: this.pollingInterval,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as SaneWalletConnectProvider;
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

    async cleanup() {
        const provider = await this.getProvider();
        if (provider.removeListener) {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            provider.removeListener("close", this.deactivate);
            provider.removeListener("networkChanged", this.handleUpdate);
            provider.removeListener("accountsChanged", this.handleUpdate);
            provider.removeListener("chainChanged", this.handleUpdate);
        }
    }

    deactivate = async (reason?: string) => {
        await this.cleanup();
        const provider = await this.getProvider();
        if (provider.removeListener) {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            provider.removeListener("close", this.deactivate);
        }
        await provider.close();
        this.provider = undefined;
        this.emitter.emitDeactivate(reason);
    };
}
