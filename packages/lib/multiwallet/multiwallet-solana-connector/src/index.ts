import { RenNetwork } from "@renproject/interfaces";
import {
    ConnectorEmitter,
    ConnectorInterface,
    ConnectorUpdate,
} from "@renproject/multiwallet-base-connector";
import Wallet from "@project-serum/sol-wallet-adapter";
import { Connection, clusterApiUrl } from "@solana/web3.js";

export interface SolanaConnectorOptions {
    debug?: boolean;
    network: RenNetwork;
    providerURL: string | { postMessage: Function };
    clusterURL?: string;
}

const renNetworkToSolanaNetwork: { [k in RenNetwork]: string } = {
    [RenNetwork.DevnetVDot3]: clusterApiUrl("devnet"),
    [RenNetwork.Mainnet]: clusterApiUrl("mainnet-beta"),
    [RenNetwork.Testnet]: clusterApiUrl("devnet"),
    [RenNetwork.TestnetVDot3]: clusterApiUrl("devnet"),
    [RenNetwork.MainnetVDot3]: clusterApiUrl("mainnet-beta"),
    [RenNetwork.Localnet]: "http://localhost:8899",
};

interface SolanaProvider {
    connection: Connection;
    wallet: typeof Wallet;
}

export class SolanaConnector
    implements ConnectorInterface<SolanaProvider, string>
{
    readonly debug?: boolean;
    supportsTestnet = true;
    emitter: ConnectorEmitter<SolanaProvider, string>;
    network: RenNetwork;
    connection: Connection;
    wallet: typeof Wallet;
    providerURL: string | { postMessage: Function };
    clusterURL: string;
    constructor({
        debug = false,
        network,
        providerURL,
        clusterURL,
    }: SolanaConnectorOptions) {
        this.network = network;
        this.clusterURL = clusterURL || renNetworkToSolanaNetwork[this.network];
        this.connection = new Connection(this.clusterURL);
        this.providerURL = providerURL;
        this.emitter = new ConnectorEmitter<SolanaProvider, string>(debug);
    }

    handleUpdate = () => {
        this.getStatus()
            .then((...args) => {
                this.emitter.emitUpdate(...args);
            })
            .catch(() => this.deactivate());
    };

    async activate() {
        this.wallet = new Wallet(this.providerURL, this.clusterURL);
        this.wallet.on("connect", this.handleUpdate);
        // when disconnecting inside an external window,
        // you need to manually bind the function
        this.wallet.on("disconnect", this.deactivate.bind(this));
        await this.wallet.connect();
        return {
            provider: { connection: this.connection, wallet: this.wallet },
            renNetwork: this.network,
        };
    }

    getProvider() {
        return { connection: this.connection, wallet: this.wallet };
    }

    deactivate() {
        if (!this.emitter) return;
        this.emitter.emitDeactivate();
        this.wallet.disconnect();
    }

    // Get the complete connector status in one call
    async getStatus(): Promise<ConnectorUpdate<SolanaProvider, string>> {
        return {
            account: await this.getAccount(),
            renNetwork: this.getRenNetwork(),
            provider: this.getProvider(),
        };
    }

    // Get default wallet pubkey
    getAccount() {
        const account = this.getProvider().wallet.publicKey.toBase58();
        if (!account) {
            throw new Error("Not activated");
        }
        return account;
    }

    // Provide network selected during construction
    getRenNetwork() {
        return this.network;
    }
}
