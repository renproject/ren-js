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

export const chainStringToRenChain = {
    binanceSmartChain: BinanceSmartChain,
    ethereum: Ethereum,
    polygon: Polygon,
    fantom: Fantom,
    avalanche: Avalanche,
    solana: Solana,
};

export const mintChainMap = (providers) => {
    console.log(providers);
    const ethChains = Object.fromEntries(
        Object.entries(chainStringToRenChain).map(([name, ChainClass]) => {
            const mapper = (context: GatewayMachineContext<any>) => {
                const { destAddress, destChain, network } = context.tx;
                return new ChainClass(
                    providers[destChain].provider,
                    network,
                ).Account({
                    address: destAddress,
                    amount: "0", //  mintchains don't need amount
                });
            };
            return [name, mapper];
        }),
    );

    return {
        ...ethChains,
        solana: (context: GatewayMachineContext<any>) => {
            const { destChain, network } = context.tx;
            return new Solana(providers[destChain].connector, network);
        },
    };
};

export const lockChainMap = {
    bitcoin: () => Bitcoin(),
    zcash: () => Zcash(),
    bitcoinCash: () => BitcoinCash(),
};
