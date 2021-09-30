import { RenNetwork } from "@renproject/interfaces";
import {
    ConnectorEmitter,
    ConnectorInterface,
    ConnectorUpdate,
} from "@renproject/multiwallet-base-connector";
import Wallet from "@project-serum/sol-wallet-adapter/dist/esm/index";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";

export interface SolanaConnectorOptions {
    debug?: boolean;
    network: RenNetwork;
    providerURL: string | { postMessage: Function };
    clusterURL?: string;
}

const renNetworkToSolanaNetwork: { [k in RenNetwork]: string } = {
    [RenNetwork.Devnet]: clusterApiUrl("devnet"),
    [RenNetwork.Mainnet]: clusterApiUrl("mainnet-beta"),
    [RenNetwork.Testnet]: clusterApiUrl("devnet"),
    [RenNetwork.Localnet]: "http://localhost:8899",
};

interface SolanaProvider {
    connection: Connection;
    wallet: Wallet;
}

export class SolanaConnector
    implements ConnectorInterface<SolanaProvider, string>
{
    readonly debug?: boolean;
    supportsTestnet = true;
    emitter: ConnectorEmitter<SolanaProvider, string>;
    network: RenNetwork;
    connection: Connection;
    wallet: Wallet;
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
        this.wallet = new Wallet(this.providerURL, this.clusterURL);
    }

    handleUpdate = () => {
        this.getStatus()
            .then((...args) => {
                this.emitter.emitUpdate(...args);
            })
            .catch(() => this.deactivate());
    };

    async activate() {
        const solana =
            typeof this.providerURL === "object"
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (this.providerURL as any)
                : this.wallet;

        this.wallet.on("connect", this.handleUpdate);
        // when disconnecting inside an external window,
        // you need to manually bind the function
        this.wallet.on("disconnect", this.deactivate.bind(this));
        await this.wallet.connect();

        // // console.log(await this.wallet.connect());
        const [publicKey, _] = await Promise.all([
            new Promise((resolve, reject) => {
                solana.on("connect", (pk: PublicKey) => {
                    resolve(pk);
                });
                solana.on("disconnect", (d: unknown) => {
                    this.deactivate.bind(this);
                    reject(d);
                });
            }),
            (async () => {
                return await solana.connect();
            })(),
        ]);

        // Send conencted message to @solana/sol-wallet-adapter
        this.wallet.handleMessage({
            data: {
                id: 67,
                method: "connected",
                params: {
                    autoApprove: false,
                    publicKey: (publicKey as PublicKey).toBase58(),
                },
            },
            source: window,
        } as any);

        return {
            account: publicKey
                ? (publicKey as PublicKey).toBase58()
                : this.getAccount(),
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
        // if this fails, we can't do much
        this.wallet.disconnect() as any;
    }

    // Get the complete connector status in one call
    async getStatus(): Promise<ConnectorUpdate<SolanaProvider, string>> {
        return {
            account: this.getAccount(),
            renNetwork: this.getRenNetwork(),
            provider: this.getProvider(),
        };
    }

    // Get default wallet pubkey
    getAccount() {
        const account = this.getProvider().wallet.publicKey?.toBase58();
        if (!account) {
            this.deactivate();
            console.error("missing account");
            throw new Error("Not activated");
        }
        return account;
    }

    // Provide network selected during construction
    getRenNetwork() {
        return this.network;
    }
}
