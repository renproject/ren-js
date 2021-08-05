import { EthArgs, Logger, NullLogger } from "@renproject/interfaces";

import { assertType } from "./assert";
import {
    fromBase64,
    fromHex,
    Ox,
    rawEncode,
    toBase64,
    toURLBase64,
} from "./common";
import { keccak256 } from "./hash";

// export const generateNHash = (tx: Tx): Buffer => {
//     const encoded = rawEncode(
//         ["bytes32", "bytes32"],
//         [Ox(tx.hash), Ox(tx.args.n)],
//     );

//     return keccak256(encoded);
// };

/**
 * Hash the payloads associated with a RenVM cross-chain transaction.
 *
 * @param zip An array (or spread) of parameters with with types defined.
 */
export const generatePHash = (
    zip: EthArgs,
    logger: Logger = NullLogger,
): Buffer => {
    // Check if they called as hashPayload([...]) instead of hashPayload(...)
    const args = (
        Array.isArray(zip[0]) ? (zip[0] as unknown as EthArgs) : zip
    ).filter((arg) => !arg.notInPayload);

    const types = args.map((param) => param.type);
    const values = args.map((param): unknown => param.value);

    const message = rawEncode(types, values);
    const digest = keccak256(message);

    logger.debug("pHash", toBase64(digest), Ox(message), args);

    return digest; // sha3 can accept a Buffer
};

export const generateSHash = (selector: string): Buffer => {
    const toSelector = selector.replace(/\/.*To/, "/to");
    return keccak256(Buffer.from(toSelector));
};

export const generateGHash = (
    payload: EthArgs,
    to: string,
    tokenIdentifier: string,
    nonce: Buffer,
    v2?: boolean,
    logger: Logger = NullLogger,
): Buffer => {
    // Type validation
    assertType<Buffer>("Buffer", { nonce });
    assertType<string>("string", { to, token: tokenIdentifier });

    const pHash = generatePHash(payload, logger);
    const sHash = fromHex(tokenIdentifier);
    const toBytes = fromHex(to);

    const encoded = v2
        ? Buffer.concat([pHash, sHash, toBytes, nonce])
        : rawEncode(
              ["bytes32", "address", "address", "bytes32"],
              [pHash, tokenIdentifier, to, nonce],
          );

    const digest = keccak256(encoded);

    logger.debug("gHash", toBase64(digest), Ox(encoded));

    return digest;
};

export const generateNHash = (
    nonce: Buffer,
    txid: Buffer,
    txindex: string,
    v2?: boolean,
    logger: Logger = NullLogger,
): Buffer => {
    const encoded = v2
        ? Buffer.concat([
              nonce,
              txid,
              rawEncode(["uint32"], [txindex]).slice(-4),
          ])
        : rawEncode(["bytes32", "bytes32", "uint32"], [nonce, txid, txindex]);

    const digest = keccak256(encoded);

    logger.debug("nHash", toBase64(digest), Ox(encoded));

    return digest;
};

export const generateSighash = (
    pHash: Buffer,
    amount: number | string,
    to: string,
    tokenIdentifier: string,
    nonceHash: Buffer,
    v2?: boolean,
    logger: Logger = NullLogger,
): Buffer => {
    // Type validation
    assertType<string>("string", { to, tokenIdentifier });
    assertType<Buffer>("Buffer", { pHash, nonceHash });

    const encoded = rawEncode(
        [
            "bytes32",
            "uint256",
            v2 ? "bytes32" : "address",
            "address",
            "bytes32",
        ],
        [pHash, amount, Ox(tokenIdentifier), Ox(to), nonceHash],
    );

    const digest = keccak256(encoded);

    logger.debug("sigHash", toBase64(digest), Ox(encoded));

    return digest;
};

export const renVMHashToBase64 = (txHash: string, v2?: boolean) => {
    // Type validation
    assertType<string>("string", { txHash });

    // Hex
    if (/^(0x)?[0-9a-fA-Z]{64}$/.exec(txHash)) {
        return (v2 ? toURLBase64 : toBase64)(fromHex(txHash));
    }
    // Already base64. For v2, ensure it's in URL-base64 format.
    return v2 ? toURLBase64(fromBase64(txHash)) : txHash;
};
