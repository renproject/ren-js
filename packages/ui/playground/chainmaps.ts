import { Solana } from "../../lib/chains/chains-solana/src";
import {
    Ethereum,
    BinanceSmartChain,
    Polygon,
    Fantom,
    Avalanche,
} from "../../lib/chains/chains-ethereum/src";
import { Bitcoin, Zcash, BitcoinCash } from "../../lib/chains/chains-bitcoin";
import { GatewayMachineContext } from "@renproject/ren-tx";

export const mintChainMap = (providers) => ({
    binanceSmartChain: (context: GatewayMachineContext<any>) => {
        const { destAddress, destChain, network } = context.tx;
        return new BinanceSmartChain(providers[destChain], network).Account({
            address: destAddress,
        });
    },
    ethereum: (context: GatewayMachineContext<any>) => {
        const { destAddress, destChain, network } = context.tx;
        return new Ethereum(providers[destChain], network).Account({
            address: destAddress,
        });
    },
    polygon: (context: GatewayMachineContext<any>) => {
        const { destAddress, destChain, network } = context.tx;
        return new Polygon(providers[destChain], network).Account({
            address: destAddress,
        });
    },
    fantom: (context: GatewayMachineContext<any>) => {
        const { destAddress, destChain, network } = context.tx;
        return new Fantom(providers[destChain], network).Account({
            address: destAddress,
        });
    },
    avalanche: (context: GatewayMachineContext<any>) => {
        const { destAddress, destChain, network } = context.tx;
        return new Avalanche(providers[destChain], network).Account({
            address: destAddress,
        });
    },
    solana: (context: GatewayMachineContext<any>) => {
        const { destChain, network } = context.tx;
        return new Solana(providers[destChain].connector, network);
    },
});

export const lockChainMap = {
    bitcoin: () => Bitcoin(),
    zcash: () => Zcash(),
    bitcoinCash: () => BitcoinCash(),
};
