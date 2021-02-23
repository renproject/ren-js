import { EthAddress } from "@renproject/chains-ethereum";
import { RenNetwork } from "@renproject/interfaces";
import {
    AbstractEthereumConnector,
    SaneProvider,
    AbstractEthereumConnectorOptions,
} from "@renproject/multiwallet-abstract-ethereum-connector";
import { ConnectorInterface } from "@renproject/multiwallet-base-connector";

export interface EthereumConnectorOptions
    extends AbstractEthereumConnectorOptions {
    debug: boolean;
    rpc: { [chainId: number]: string };
    chainId: number;
}

export type MewProvider = SaneProvider & {
    on?: (event: string, callback: () => void) => void;
    enable?: () => Promise<void>;
};

export class EthereumMEWConnectConnector extends AbstractEthereumConnector<MewProvider> {
    private readonly rpc: { [chainId: number]: string };
    private readonly chainId: number;

    private provider?: MewProvider;
    private mewConnectProvider?: MewProvider;
    supportsTestnet = false;
    constructor(options: EthereumConnectorOptions) {
        super(options);
        this.chainId = options.chainId;
        for (const rpc of Object.values(options.rpc)) {
            if (!rpc.startsWith("ws://") && !rpc.startsWith("wss://")) {
                throw new Error("rpc must be websocket (wss://)");
            }
        }
        this.rpc = options.rpc;
    }

    handleUpdate = () => {
        this.getStatus()
            .then((...args) => {
                this.emitter.emitUpdate(...args);
            })
            .catch(async (...args) => this.deactivate(...args));
    };

    activate: ConnectorInterface<
        MewProvider,
        EthAddress
    >["activate"] = async () => {
        // No good typings for injected providers exist...
        const provider = await this.getProvider();
        if (!provider) {
            throw Error("Missing Provider");
        }
        if (!this.mewConnectProvider) {
            throw Error("Missing MEWConnect Provider");
        }
        // clear any hanging listeners
        await this.cleanup();

        if (provider.enable) {
            await provider.enable().catch((error: Error): void => {
                // TODO ideally this would be a better check
                if (error.message === "User closed modal") {
                    this.emitter.emitError(new Error("User rejected request"));
                }

                throw error;
            });
        }

        if (this.mewConnectProvider.on) {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            this.mewConnectProvider.on("disconnected", this.deactivate);
        }
        if (provider.on) {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            provider.on("close", this.deactivate);
            provider.on("networkChanged", this.handleUpdate);
            provider.on("accountsChanged", this.handleUpdate);
            provider.on("chainChanged", this.handleUpdate);
        }
        return this.getStatus();
    };

    getProvider = async () => {
        if (this.provider) return this.provider;
        const { Provider } = await import(
            "@myetherwallet/mewconnect-web-client"
        ).then((m) => m?.default ?? m);
        const mewConnectProvider = new Provider({
            windowClosedError: true,
        });

        this.mewConnectProvider = mewConnectProvider;
        this.provider = mewConnectProvider.makeWeb3Provider(
            this.chainId,
            this.rpc[this.chainId],
            true
        ) as SaneProvider;
        return this.provider;
    };

    // Get default web3 account
    getAccount = async () => {
        return (await this.getProvider())
            .send("eth_accounts", [])
            .then((accounts: string[]): string => accounts[0]);
    };
    // Cast current ethereum network to Ren network version or throw
    getRenNetwork = async (): Promise<RenNetwork> => {
        if (!this.provider) throw new Error("not initialized");
        return this.networkIdMapper(
            await this.provider.send("eth_chainId", [])
        );
    };

    async cleanup() {
        if (this.mewConnectProvider && this.mewConnectProvider.removeListener) {
            this.mewConnectProvider.removeListener(
                "disconnected",
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                this.deactivate
            );
        }
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
        if (provider.close) {
            await provider.close();
        }
        this.emitter.emitDeactivate(reason);
    };
}
