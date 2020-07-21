import { Asset, HostChain, RenContract, RenTokens } from "@renproject/interfaces";
import Web3 from "web3";

export class Ethereum implements HostChain {
    public name = "Eth";

    public readonly getTokenAddress = (web3: Web3, token: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => getTokenAddress(stringToNetwork(this.network), web3, token);
    public readonly getGatewayAddress = (web3: Web3, token: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => getGatewayAddress(stringToNetwork(this.network), web3, token);

    constructor() {
        if (!(this instanceof Ethereum)) return new Ethereum();
    }
}
