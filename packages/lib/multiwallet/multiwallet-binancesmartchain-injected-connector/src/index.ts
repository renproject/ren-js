import { RenNetwork } from "@renproject/interfaces";
import { EthereumConnectorOptions } from "@renproject/multiwallet-abstract-ethereum-connector";
import { EthereumInjectedConnector } from "@renproject/multiwallet-ethereum-injected-connector";

export interface BinanceSmartChainConnectorOptions
    extends EthereumConnectorOptions {
    debug: boolean;
}

const bscNetworkToRenNetworkMapper = (id: number) => {
    return {
        97: RenNetwork.Testnet,
        56: RenNetwork.Mainnet,
    }[id];
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
        return window.BinanceChain || window.ethereum;
    };
}
