import { Solana } from "../../lib/chains/chains-solana/src";
import {
    Ethereum,
    BinanceSmartChain,
    Polygon,
    Fantom,
    Avalanche,
} from "../../lib/chains/chains-ethereum/src";
import {
    Bitcoin,
    Zcash,
    BitcoinCash,
    DigiByte,
    Dogecoin,
} from "../../lib/chains/chains-bitcoin";
import { Filecoin } from "../../lib/chains/chains-filecoin";
import { Terra } from "../../lib/chains/chains-terra";
import { BurnMachineContext, GatewayMachineContext } from "@renproject/ren-tx";

export const chainStringToRenChain = {
    binanceSmartChain: BinanceSmartChain,
    ethereum: Ethereum,
    polygon: Polygon,
    fantom: Fantom,
    avalanche: Avalanche,
    solana: Solana,
};

export const releaseChains = {
    bitcoin: Bitcoin,
    zcash: Zcash,
    bitcoinCash: BitcoinCash,
    dogecoin: Dogecoin,
    terra: Terra,
    filecoin: Filecoin,
    dgb: DigiByte,
};

export const mintChainMap = (providers) => {
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
            const { destChain, destAddress, network } = context.tx;
            return new Solana(providers[destChain].connector, network, {
                logger: console,
            }).Account({ address: destAddress });
        },
    };
};

export const burnChainMap = (providers) => {
    const ethChains = Object.fromEntries(
        Object.entries(chainStringToRenChain).map(([name, ChainClass]) => {
            const mapper = (context: BurnMachineContext<any, any>) => {
                const { destAddress, sourceChain, network } = context.tx;
                const amount = context.tx.targetAmount;
                return new ChainClass(
                    providers[sourceChain].provider,
                    network,
                ).Account({
                    address: destAddress,
                    amount, //  mintchains don't need amount
                    value: amount,
                });
            };
            return [name, mapper];
        }),
    );

    return {
        ...ethChains,
    };
};

export const lockChainMap = (() => {
    return Object.fromEntries(
        Object.entries(releaseChains).map(([name, ChainClass]) => {
            const mapper = (context: GatewayMachineContext<any, any>) => {
                const { destAddress } = context.tx;
                return new ChainClass().Address(destAddress);
            };
            return [name, mapper];
        }),
    );
})();

export const releaseChainMap = (() => {
    return Object.fromEntries(
        Object.entries(releaseChains).map(([name, ChainClass]) => {
            const mapper = (context: BurnMachineContext<any, any>) => {
                const { destAddress } = context.tx;
                return new ChainClass().Address(destAddress);
            };
            return [name, mapper];
        }),
    );
})();
