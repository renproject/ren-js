import { Chain, Tx } from "@renproject/interfaces";
import { RenNetworkDetails } from "@renproject/contracts";
import RenJS from "@renproject/ren";
import BigNumber from "bignumber.js";

const getDecimals = (chain: Chain) => {
    switch (chain) {
        case Chain.Bitcoin:
            return 8;
        case Chain.Zcash:
            return 8;
        case Chain.BitcoinCash:
            return 8;
        case Chain.Ethereum:
            return 8;
    }
};

export const renderAmount = (tx: Tx) => {
    if (tx.chain === Chain.Ethereum || !tx.utxo) {
        return "";
    }
    const decimals = getDecimals(tx.chain);
    const value = new BigNumber(tx.utxo.amount).div(
        new BigNumber(10).exponentiatedBy(decimals),
    );
    const valueString = value.gte(1)
        ? value.mod(0.001).isZero()
            ? // No decimals past 0.001, trim and call toFixed(0) (which removes ending 0s)
              value.decimalPlaces(3).toFixed()
            : // Call toFixed(3) (doesn't remove ending 0s)
              value.toFixed(3)
        : value.toFixed();
    return `${valueString} ${tx.chain.toUpperCase()}`;
};

export const txUrl = (tx: Tx | null, network: RenNetworkDetails): string => {
    if (!tx) {
        return "";
    }

    if (tx.chain === RenJS.Chains.Ethereum) {
        return `${network.etherscan}/tx/${tx.hash}`;
    }

    const id = tx.utxo ? tx.utxo.txHash : tx.address || "";

    const isAddress = tx.address && id === tx.address;
    switch (tx.chain) {
        case RenJS.Chains.Bitcoin:
            return `https://sochain.com/${isAddress ? "address" : "tx"}/BTC${
                network.isTestnet ? "TEST" : ""
            }/${RenJS.utils.strip0x(id)}`;
        case RenJS.Chains.Zcash:
            return `https://sochain.com/${isAddress ? "address" : "tx"}/ZEC${
                network.isTestnet ? "TEST" : ""
            }/${RenJS.utils.strip0x(id)}`;
        case RenJS.Chains.BitcoinCash:
            return `https://explorer.bitcoin.com/${
                network.isTestnet ? "t" : ""
            }bch/${isAddress ? "address" : "tx"}/${RenJS.utils.strip0x(id)}`;
    }
    return "";
};

export const txPreview = (tx: Tx, length = 20): string => {
    const id =
        tx.chain === RenJS.Chains.Ethereum
            ? tx.hash
            : tx.utxo
            ? tx.utxo.txHash
            : tx.address || "";

    const firstSection = Math.min(id.length, 10);
    const secondSection = Math.max(0, length - firstSection);

    return `${id.slice(0, firstSection)}...${id.slice(
        id.length - secondSection,
        id.length,
    )}`;
};
