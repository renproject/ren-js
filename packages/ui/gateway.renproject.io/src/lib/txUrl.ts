import { Chain, NetworkDetails, Tx } from "@renproject/interfaces";
import RenJS from "@renproject/ren";

export const txUrl = (tx: Tx | null, network: NetworkDetails): string => {
    if (!tx) { return ""; }

    if (tx.chain === RenJS.Chains.Ethereum) {
        return `${network.contracts.etherscan}/tx/${tx.hash}`;
    }

    const id = tx.utxo ? tx.utxo.txHash : (tx.address || "");

    const isAddress = tx.address && id === tx.address;
    switch (tx.chain) {
        case RenJS.Chains.Bitcoin:
            return `https://chain.so/${isAddress ? "address" : "tx"}/BTC${network.isTestnet ? "TEST" : ""}/${RenJS.utils.strip0x(id)}`;
        case RenJS.Chains.Zcash:
            return `https://chain.so/${isAddress ? "address" : "tx"}/ZEC${network.isTestnet ? "TEST" : ""}/${RenJS.utils.strip0x(id)}`;
        case RenJS.Chains.BitcoinCash:
            return `https://explorer.bitcoin.com/${network.isTestnet ? "t" : ""}bch/${isAddress ? "address" : "tx"}/${RenJS.utils.strip0x(id)}`;
    }
    return "";
};

export const txPreview = (tx: Tx, length = 20): string => {

    const id = tx.chain === RenJS.Chains.Ethereum ? tx.hash : tx.utxo ? tx.utxo.txHash : (tx.address || "");

    const firstSection = Math.min(id.length, 10);
    const secondSection = Math.max(0, length - firstSection);

    return `${id.slice(0, firstSection)}...${id.slice(id.length - secondSection, id.length)}`;
};
