import { sha256 as createSha256 } from "@noble/hashes/sha256";
import { keccak_256 as createKeccak256 } from "@noble/hashes/sha3";

import { assertType } from "./assert";
import { concat } from "./common";

/**
 * Returns the keccak256 hash of an array of Uint8Arrays. The inputs are
 * concatenated before being hashed.
 *
 * @param msg One ore more Uint8Arrays to hash.
 * @returns The keccak256 hash of the concatenated input Uint8Arrays.
 */
export const keccak256 = (...msg: Uint8Array[]): Uint8Array => {
    assertType<Uint8Array[]>("Uint8Array[]", { msg });
    return new Uint8Array(createKeccak256(concat(msg)));
};

/**
 * Returns the sha256 hash of an array of Uint8Arrays. The inputs are
 * concatenated before being hashed.
 *
 * @param msg One ore more Uint8Arrays to hash.
 * @returns The sha256 hash of the concatenated input Uint8Arrays.
 */
export const sha256 = (...msg: Uint8Array[]): Uint8Array => {
    assertType<Uint8Array[]>("Uint8Array[]", { msg });
    return new Uint8Array(createSha256(concat(msg)));
};
