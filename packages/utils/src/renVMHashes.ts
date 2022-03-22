import BigNumber from "bignumber.js";

import { utils } from "./internal";
import { pack, TypedPackValue } from "./libraries/pack";

/**
 * Creating a RenVM transaction involves calculating several hashes, used to
 * tie/commit the transaction to particular data.
 *
 * Transactions can be associated with a payload which specifies what should
 * be done with the transaction ones it's complete - e.g. after renBTC is
 * minted on Ethereum, it should be swapped for ETH. This payload can be
 * of arbitrary-length, so it's hashed to a 32-byte value using the phash
 * (or payload hash).
 *
 * The shash (or selector hash) is the hash of the selector
 * (e.g. "BTC/toEthereum").
 *
 * The ghash (gateway hash) links the payload/phash, the selector/shash,
 * the transaction's recipient and the nonce into a single value that is then
 * used to create a unique gateway address (for deposit-based transactions).
 *
 * The nhash (nonce hash) hashes the nonce, txid and txindex in order to create
 * a unique identifier of the deposit/input transaction.
 *
 * The sighash (signature hash) ties all these together, hashing the phash,
 * the amount being minted/released, the transaction's recipient, the shash and
 * the nhash. It's then signed by RenVM, and re-calculated in the gateway
 * contracts in order to spend the signature. When burning-and-releasing, the
 * sighash is empty.
 */

/**
 * Calculate the RenVM pHash (payload hash) from a payload (alias for keccak256).
 */
export const generatePHash = utils.keccak256;

/**
 * Calculate the RenVM sHash (selector hash). Normalizes the selector to remove
 * the origin-chain for burn-and-mints.
 *
 * @example
 * ```
 * generateSHash("BTC/toEthereum") === keccak256("BTC/toEthereum")
 * generateSHash("BTC/fromFantomToEthereum") === keccak256("BTC/toEthereum")
 * ```
 */
export const generateSHash = (selector: string): Uint8Array => {
    utils.assertType<string>("string", { selector });

    const encoder = new TextEncoder();
    const toSelector: Uint8Array = encoder.encode(
        selector.replace(/\/.*To/, "/to"),
    );
    return utils.keccak256(toSelector);
};

/**
 * Calculate the RenVM gHash (gateway hash) - keccak256(pHash, sHash, to, nonce)
 *
 * NOTICE: Since RenJS v2, the interface has changed such that:
 * 1. the first parameter is the pHash instead of the payload, and
 * 2. the second and third parameters (sHash and to) have been swapped.
 */
export const generateGHash = (
    pHash: Uint8Array,
    sHash: Uint8Array,
    to: Uint8Array,
    nonce: Uint8Array,
): Uint8Array => {
    utils.assertType<Uint8Array>("Uint8Array", { pHash, nonce, sHash, to });

    return utils.keccak256(pHash, sHash, to, nonce);
};

/**
 * Calculate the RenVM nHash (nonce hash), calculated as
 * `keccak256(nonce, txid, toNBytes(txindex, 4))`
 */
export const generateNHash = (
    nonce: Uint8Array,
    txid: Uint8Array,
    txindex: string,
): Uint8Array => {
    utils.assertType<Uint8Array>("Uint8Array", { nonce, txid });
    utils.assertType<string>("string", { txindex });

    return utils.keccak256(nonce, txid, utils.toNBytes(txindex, 4));
};

/**
 * Calculate the RenVM sigHash (signature hash). This is the value signed by
 * RenVM for mints and releases.
 */
export const generateSighash = (
    pHash: Uint8Array,
    amount: BigNumber,
    to: Uint8Array,
    sHash: Uint8Array,
    nHash: Uint8Array,
): Uint8Array => {
    utils.assertType<Uint8Array>("Uint8Array", { pHash, nHash, sHash, to });
    utils.assertType<BigNumber>("BigNumber", { amount });

    if (pHash.length !== 32) {
        throw new Error(
            `Invalid pHash length - ${pHash.length} instead of 32.`,
        );
    }

    if (sHash.length !== 32) {
        throw new Error(
            `Invalid pHash length - ${sHash.length} instead of 32.`,
        );
    }

    if (nHash.length !== 32) {
        throw new Error(
            `Invalid pHash length - ${nHash.length} instead of 32.`,
        );
    }

    const encoded = utils.concat([
        pHash,
        utils.toNBytes(amount, 32),
        sHash,
        utils.padUint8Array(to, 32),
        nHash,
    ]);

    return utils.keccak256(encoded);
};

/**
 * Calculate the hash of a RenVM transaction.
 *
 * @returns A buffer of the hash. It should be converted to url-base64 before
 * being shown to users.
 */
export const generateTransactionHash = (
    version: string,
    selector: string,
    packValue: TypedPackValue,
): Uint8Array => {
    utils.assertType<string>("string", { version, selector });
    return utils.sha256(
        pack.binaryMarshal.encodeString(version),
        pack.binaryMarshal.encodeString(selector),
        pack.binaryMarshal.encodeTypedPackValue(packValue),
    );
};
