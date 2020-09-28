import {
    ConnectorEmitter,
    ConnectorUpdate,
    ConnectorInterface,
} from "@renproject/multiwallet-base-connector";
import { provider, HttpProvider } from "web3-providers";
import { Address } from "@renproject/chains-ethereum";
import Web3 from "web3";
import { RenNetwork } from "@renproject/interfaces";

const isResults = <T>(x: { results: T } | T): x is { results: T } =>
    (x as { results: T }).results !== undefined;

const resultOrRaw = <T>(x: { results: T } | T) => {
    if (isResults(x)) {
        return x.results;
    }
    return x;
};

export const ethNetworkToRenNetwork = (id: number): RenNetwork => {
    return {
        1: RenNetwork.Mainnet,
        42: RenNetwork.Testnet,
    }[id];
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
    emitter;
    library?: Web3;
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
        debugger;
        return {
            account: await this.getAccount(),
            renNetwork: await this.getRenNetwork(),
            provider: await this.getProvider(),
        };
    }

    // Get default web3 account
    async getAccount() {
        const account = resultOrRaw(
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
            resultOrRaw((await this.getProvider()) as any).request({
                method: "eth_chainId",
            })
        );
    }
}
