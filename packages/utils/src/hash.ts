import { keccak256 as keccak256_ } from "ethereum-cryptography/keccak";
import { ripemd160 as ripemd160_ } from "ethereum-cryptography/ripemd160";
import { sha256 as sha256_ } from "ethereum-cryptography/sha256";

/** Return the SHA-256 hash of the Buffer input as a Buffer. */
export const sha256 = (input: Buffer) => Buffer.from(sha256_(input));

/** Return the KECCAK-256 hash of the Buffer input as a Buffer. */
export const keccak256 = (input: Buffer) => Buffer.from(keccak256_(input));

/** Return the RIPEMD-160 hash of the Buffer input as a Buffer. */
export const ripemd160 = (input: Buffer) => Buffer.from(ripemd160_(input));
