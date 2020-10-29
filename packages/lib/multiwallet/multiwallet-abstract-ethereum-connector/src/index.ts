import { Address } from "@renproject/chains-ethereum";
import { RenNetwork } from "@renproject/interfaces";
import {
    ConnectorEmitter,
    ConnectorInterface,
    ConnectorUpdate,
} from "@renproject/multiwallet-base-connector";
import { HttpProvider, provider } from "web3-providers";

const isResults = <T>(x: { results: T } | T): x is { results: T } =>
    (x as { results: T }).results !== undefined;

const resultOrRaw = <T>(x: { results: T } | T) => {
    if (isResults(x)) {
        return x.results;
    }
    return x;
};

export const ethNetworkToRenNetwork = (id: number | string): RenNetwork => {
    let decodedId = id;
    if (typeof id === "string") {
        try {
            decodedId = parseInt(id);
        } catch (e) {
            decodedId = Buffer.from(id.split("0x").pop() || "", "hex")[0];
        }
    }
    return {
        1: RenNetwork.Mainnet,
        42: RenNetwork.Testnet,
    }[decodedId];
};

export interface EthereumConnectorOptions {
    debug?: boolean;
    // Map chain ids to ren network versions
    networkIdMapper?: typeof ethNetworkToRenNetwork;
}

type SaneProvider = Exclude<provider, string | null | HttpProvider>;

export abstract class AbstractEthereumConnector
    implements ConnectorInterface<SaneProvider, Address> {
    supportsTestnet = true;
    networkIdMapper = ethNetworkToRenNetwork;
    emitter: ConnectorEmitter<SaneProvider, Address>;
    constructor({
        debug = false,
        networkIdMapper = ethNetworkToRenNetwork,
    }: EthereumConnectorOptions) {
        this.networkIdMapper = networkIdMapper;
        this.emitter = new ConnectorEmitter<SaneProvider, Address>(debug);
    }
    abstract activate: ConnectorInterface<SaneProvider, Address>["activate"];
    abstract getProvider: ConnectorInterface<
        SaneProvider,
        Address
    >["getProvider"];
    abstract deactivate: ConnectorInterface<
        SaneProvider,
        Address
    >["deactivate"];
    // Get the complete connector status in one call
    async getStatus(): Promise<ConnectorUpdate<SaneProvider, Address>> {
        return {
            account: await this.getAccount(),
            renNetwork: await this.getRenNetwork(),
            provider: await this.getProvider(),
        };
    }

    // Get default ethereum account
    async getAccount() {
        const account = resultOrRaw(
            // tslint:disable-next-line: no-any
            await ((await this.getProvider()) as any).request({
                method: "eth_requestAccounts",
            })
        )[0];
        if (!account) {
            throw new Error("Not activated");
        }
        return account;
    }
    // Cast current ethereum network to Ren network version or throw
    async getRenNetwork() {
        return this.networkIdMapper(
            // tslint:disable-next-line: no-any
            await resultOrRaw((await this.getProvider()) as any).request({
                method: "eth_chainId",
            })
        );
    }
}
