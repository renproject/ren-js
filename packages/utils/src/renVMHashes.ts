import BigNumber from "bignumber.js";
import { keccak256 as jsKeccak256 } from "js-sha3";

import { assertType } from "./assert";
import { padBuffer, toNBytes } from "./common";

/**
 * Return the keccak256 hash of an array of buffers. The inputs are concatenated
 * before being hashed.
 */
export const keccak256 = (...msg: Buffer[]): Buffer => {
    assertType<Buffer[]>("Buffer[]", { msg });

    return Buffer.from(
        (jsKeccak256 as unknown as { buffer: typeof jsKeccak256 }).buffer(
            Buffer.concat(msg),
        ),
    );
};

/**
 * Calculate the RenVM pHash from a payload (alias for keccak256).
 */
export const generatePHash = keccak256;

/**
 * Calculate the RenVM sHash. Normalizes the selector to remove the origin-chain
 * for burn-and-mints.
 *
 * @example
 * ```
 * generateSHash("BTC/toEthereum") === keccak256("BTC/toEthereum")
 * generateSHash("BTC/fromFantomToEthereum") === keccak256("BTC/toEthereum")
 * ```
 */
export const generateSHash = (selector: string): Buffer => {
    assertType<string>("string", { selector });

    const toSelector = Buffer.from(selector.replace(/\/.*To/, "/to"));
    return keccak256(toSelector);
};

/**
 * Calculate the RenVM gHash - keccak256(pHash, sHash, to, nonce).
 *
 * NOTICE: Since RenJS v2, the interface has changed such that:
 * 1. the first parameter is the pHash instead of the payload, and
 * 2. the second and third parameters (sHash and to) have been swapped.
 */
export const generateGHash = (
    pHash: Buffer,
    sHash: Buffer,
    to: Buffer,
    nonce: Buffer,
): Buffer => {
    assertType<Buffer>("Buffer", { pHash, nonce, sHash, to });

    return keccak256(pHash, sHash, to, nonce);
};

/**
 * Calculate the RenVM nHash - keccak256(nonce, txid, toNBytes(txindex, 4))
 */
export const generateNHash = (
    nonce: Buffer,
    txid: Buffer,
    txindex: string,
): Buffer => {
    assertType<Buffer>("Buffer", { nonce, txid });
    assertType<string>("string", { txindex });

    return keccak256(nonce, txid, toNBytes(txindex, 4));
};

/**
 * Calculate the RenVM sigHash.
 */
export const generateSighash = (
    pHash: Buffer,
    amount: BigNumber,
    to: Buffer,
    sHash: Buffer,
    nHash: Buffer,
): Buffer => {
    assertType<Buffer>("Buffer", { pHash, nHash, sHash, to });
    assertType<BigNumber>("BigNumber", { amount });

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

    const encoded = Buffer.concat([
        pHash,
        toNBytes(amount, 32),
        sHash,
        padBuffer(to, 32),
        nHash,
    ]);

    return keccak256(encoded);
};
