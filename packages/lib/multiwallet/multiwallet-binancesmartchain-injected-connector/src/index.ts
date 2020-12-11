import { RenNetwork } from "@renproject/interfaces";
import { AbstractEthereumConnectorOptions } from "@renproject/multiwallet-abstract-ethereum-connector";
import {
    EthereumInjectedConnector,
    InjectedProvider,
} from "@renproject/multiwallet-ethereum-injected-connector";

export interface BinanceSmartChainConnectorOptions
    extends AbstractEthereumConnectorOptions {
    debug: boolean;
}

const bscNetworkToRenNetworkMapper = (id: number | string) => {
    let decodedId = id;
    if (typeof id === "string") {
        try {
            decodedId = parseInt(id);
        } catch (e) {
            decodedId = Buffer.from(id.split("0x").pop() || "", "hex")[0];
        }
    }
    return {
        97: RenNetwork.Testnet,
        56: RenNetwork.Mainnet,
    }[decodedId];
};

export class BinanceSmartChainInjectedConnector extends EthereumInjectedConnector {
    supportsTestnet = true;
    constructor(options: BinanceSmartChainConnectorOptions) {
        super({
            networkIdMapper: bscNetworkToRenNetworkMapper,
            ...options,
        });
    }

    getProvider = () => {
        return (window.BinanceChain || window.ethereum) as InjectedProvider;
    };
}
