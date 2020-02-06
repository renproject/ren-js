
import RenJS, { NetworkDetails } from "@renproject/ren";
import { Tx } from "@renproject/ren-js-common";

export const txUrl = (tx: Tx | null, network: NetworkDetails): string => {
    if (!tx) { return ""; }
    const isTx = tx.hash && tx.hash.slice && tx.hash.match(/^(0x)?[a-fA-F0-9]+$/);
    switch (tx.chain) {
        case RenJS.Chains.Ethereum:
            return `${network.contracts.etherscan}/tx/${tx.hash}`;
        case RenJS.Chains.Bitcoin:
            return `https://chain.so/${isTx ? "tx" : "address"}/BTC${network.isTestnet ? "TEST" : ""}/${RenJS.utils.strip0x(tx.hash)}`;
        case RenJS.Chains.Zcash:
            return `https://chain.so/${isTx ? "tx" : "address"}/ZEC${network.isTestnet ? "TEST" : ""}/${RenJS.utils.strip0x(tx.hash)}`;
        case RenJS.Chains.BitcoinCash:
            return `https://explorer.bitcoin.com/${network.isTestnet ? "t" : ""}bch/${isTx ? "tx" : "address"}/${RenJS.utils.strip0x(tx.hash)}`;
    }
    return "";
};
