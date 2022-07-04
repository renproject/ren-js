import BigNumber from "bignumber.js";

import { utils } from "./internal";
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
        // ^(  ASSET )/[      [from(        CHAIN      ) _   to(   CHAIN  )] OR [from( CHAIN )] OR ( to(  CHAIN  ))]$
        /^([a-zA-Z]+)\/(?:(?:(?:from([a-zA-Z]+?(?=_to)))\_(?:to([a-zA-Z]+))?)|(?:from([a-zA-Z]+))|(?:to([a-zA-Z]+)))$/;
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

const EMPTY_SIGNATURE =
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
export const isEmptySignature = (sig: Uint8Array): boolean =>
    utils.toURLBase64(sig) === EMPTY_SIGNATURE;

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
    utils.assertType<Uint8Array>("Uint8Array", { signature });

    // The signature is empty, so we should modify it.
    if (isEmptySignature(signature)) {
        return signature;
    }

    const r: Uint8Array = signature.slice(0, 32);
    const s: Uint8Array = signature.slice(32, 64);
    let v: number = signature.slice(64, 65)[0];

    let sBN = new BigNumber(utils.Ox(s), 16);

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

    return utils.concat([r, utils.toNBytes(sBN, 32), new Uint8Array([v])]);
};

/** Convert a partial chain transaction to a chain transaction with all its fields. */
export const populateChainTransaction = ({
    partialTx,
    chain,
    txHashToBytes,
    txHashFromBytes,
    explorerLink,
    defaultTxindex,
}: {
    partialTx: Partial<ChainTransaction> &
        ({ txid: string } | { txHash: string });
    chain: string;
    txHashToBytes: (txHash: string) => Uint8Array;
    txHashFromBytes: (bytes: Uint8Array) => string;
    explorerLink: (
        transaction: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ) => string | undefined;
    defaultTxindex?: string;
}): ChainTransaction => {
    const maybeTxHash = partialTx.txHash;
    const txid =
        partialTx.txid ||
        (maybeTxHash && utils.toURLBase64(txHashToBytes(maybeTxHash)));
    const txHash =
        maybeTxHash ||
        (partialTx.txid && txHashFromBytes(utils.fromBase64(partialTx.txid)));
    if (!txid || !txHash) {
        throw new Error(
            `Must provide either 'txid' or 'txHash' for ${chain} transaction.`,
        );
    }
    if (partialTx.chain && partialTx.chain !== chain) {
        throw new Error(
            `Unexpected chain (expected '${chain}', got '${partialTx.chain}').`,
        );
    }
    const txindex = partialTx.txindex || defaultTxindex;
    if (!txindex) {
        throw new Error(`Must provide txindex for ${chain} transaction.`);
    }

    const tx = {
        ...partialTx,
        chain,
        txid,
        txHash,
        txindex,
    };

    return {
        ...tx,
        explorerLink: explorerLink(tx) || "",
    };
};
