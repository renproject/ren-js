import BigNumber from "bignumber.js";

import { assertType } from "./internal/assert";
import { concat, Ox, toNBytes } from "./internal/common";
import { ChainTransaction } from "./types/chain";

/**
 * Decode a RenVM selector into the asset, the from-chain and the to-chain.
 *
 * @example
 * decodeRenVMSelector("BTC/toEthereum", "Bitcoin")
 * // { asset: "BTC", from: "Bitcoin", to: "Ethereum" }
 *
 * decodeRenVMSelector("DAI/toFantom", "Ethereum")
 * // { asset: "DAI", from: "Ethereum", to: "Fantom" }
 *
 * @param selector A RenVM selector
 * @param assetChain The chain of the selector's asset
 * @returns An object containing the asset and to and from chains.
 */
export const decodeRenVMSelector = (
    selector: string,
    assetChain: string,
): {
    asset: string;
    from: string;
    to: string;
} => {
    const regex =
        // Regular Expression to match selectors in the form of
        // ASSET/fromCHAINtoCHAIN, ASSET/fromCHAIN or ASSET/toCHAIN.
        // Note: chain names can't have
        // ^(  ASSET )/[      [from(        CHAIN        )To(   CHAIN  )] OR [from( CHAIN )] OR ( to(  CHAIN  ))]$
        /^([a-zA-Z]+)\/(?:(?:(?:from([a-zA-Z]+?(?=To)))(?:To([a-zA-Z]+))?)|(?:from([a-zA-Z]+))|(?:to([a-zA-Z]+)))$/;
    const match = regex.exec(selector);
    if (!match) {
        throw new Error(`Invalid selector format '${selector}'.`);
    }
    const [_, asset, burnAndMintFrom, burnAndMintTo, burnFrom, mintTo] = match;
    return {
        asset,
        from: burnAndMintFrom || burnFrom || assetChain,
        to: burnAndMintTo || mintTo || assetChain,
    };
};

/**
 * Normalize the `s` and `v` values of a secp256k1 signature.
 *
 * This includes:
 * 1) ensuring the `v` value is either 27 or 28
 * 2) ensuring that `s` is less than secp256k1n/2
 *
 * This is required before a mint or release signature can be submitted to a
 * MintGateway or LockGateway.
 *
 * @param signature The `r`, `s` and `v` values concatenated as a Uint8Array.
 * @returns The signature in the same format, with normalized values.
 */
export const normalizeSignature = (signature: Uint8Array): Uint8Array => {
    assertType<Uint8Array>("Uint8Array", { signature });

    const r: Uint8Array = signature.slice(0, 32);
    const s: Uint8Array = signature.slice(32, 64);
    let v: number = signature.slice(64, 65)[0];

    let sBN = new BigNumber(Ox(s), 16);

    // Normalize v value
    v = ((v || 0) % 27) + 27;

    // The size of the field that secp256k1 is defined over.
    const secp256k1n = new BigNumber(
        "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
        16,
    );

    // For a given key, there are two valid signatures for each signed message.
    // We always take the one with the lower `s`.
    // Check if s > secp256k1n/2 (57896044618658097711785492504343953926418782139537452191302581570759080747168.5)
    if (sBN.gt(secp256k1n.div(2))) {
        // Take s = -s % secp256k1n
        sBN = secp256k1n.minus(sBN);
        // Switch v
        v = v === 27 ? 28 : 27;
    }

    return concat([r, toNBytes(sBN, 32), new Uint8Array([v])]);
};

export function populateChainTransaction({
    partialTx,
    chain,
    txidToTxidFormatted,
    txidFormattedToTxid,
    defaultTxindex,
}: {
    partialTx: Partial<ChainTransaction>;
    chain: string;
    txidToTxidFormatted: (txid: string) => string;
    txidFormattedToTxid: (txidFormatted: string) => string;
    defaultTxindex?: string;
}): ChainTransaction {
    if (!partialTx.txid || !partialTx.txidFormatted) {
        throw new Error(
            `Must provide either 'txid' or 'txidFormatted' for ${chain} transaction.`,
        );
    }
    if (partialTx.chain && partialTx.chain !== chain) {
        throw new Error(
            `Unexpected chain (expected '${chain}', got '$partialTx.chain}').`,
        );
    }
    if (!partialTx.txindex && !defaultTxindex) {
        throw new Error(`Must provide txindex for ${chain} transaction.`);
    }

    return {
        ...partialTx,
        chain: chain,
        txid: partialTx.txid || txidToTxidFormatted(partialTx.txidFormatted!),
        txidFormatted:
            partialTx.txidFormatted || txidFormattedToTxid(partialTx.txid!),
        txindex: partialTx.txindex || defaultTxindex!,
    };
}
