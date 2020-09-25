import {
    ConnectorEmitter,
    ConnectorUpdate,
    ConnectorInterface,
} from "@renproject/multiwallet-base-connector";
import { provider } from "web3-providers";
import { Address } from "@renproject/chains-ethereum";
import Web3 from "web3";
import { RenNetwork } from "@renproject/interfaces";

export const ethNetworkToRenNetwork = (id: number): RenNetwork => {
    return {
        1: RenNetwork.Mainnet,
        42: RenNetwork.Testnet,
    }[id];
};

export interface EthereumConnectorOptions {
    debug: boolean;
}

export abstract class AbstractEthereumConnector
    implements ConnectorInterface<provider, Address> {
    supportsTestnet = true;
    emitter;
    constructor({ debug = false }: EthereumConnectorOptions) {
        this.emitter = new ConnectorEmitter<provider, Address>(debug);
    }
    abstract activate: ConnectorInterface<provider, Address>["activate"];
    abstract getProvider: ConnectorInterface<provider, Address>["getProvider"];
    abstract deactivate: ConnectorInterface<provider, Address>["deactivate"];
    // Get the complete connector status in one call
    async getStatus(): Promise<ConnectorUpdate<provider, Address>> {
        return {
            account: await this.getAccount(),
            renNetwork: await this.getRenNetwork(),
            provider: await this.getProvider(),
        };
    }
    // Get default web3 account
    async getAccount() {
        const w3 = new Web3(await this.getProvider());
        if (!w3.defaultAccount) {
            throw new Error("Not activated");
        }
        return w3.defaultAccount;
    }
    // Cast current ethereum network to Ren network version or throw
    async getRenNetwork() {
        const w3 = new Web3(await this.getProvider());
        return ethNetworkToRenNetwork(await w3.eth.net.getId());
    }
}
