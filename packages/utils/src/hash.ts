import createHash from "create-hash";
import createKeccakHash from "keccak";

export const keccak256 = (msg: Buffer): Buffer =>
    createKeccakHash("keccak256").update(msg).digest();

export const ripemd160 = (msg: Buffer): Buffer =>
    createHash("rmd160").update(msg).digest();

export const sha256 = (msg: Buffer): Buffer =>
    createHash("sha256").update(msg).digest();

export const hash160 = (publicKey: Buffer): Buffer =>
    ripemd160(sha256(publicKey));
