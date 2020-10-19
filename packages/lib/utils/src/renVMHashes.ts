import { EthArgs, Logger, RenContract } from "@renproject/interfaces";

import { assertType } from "./assert";
import { fromHex, Ox, rawEncode, toBase64 } from "./common";
import { keccak256, sha256 } from "./hash";

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
export const generatePHash = (zip: EthArgs, logger?: Logger): Buffer => {
    // Check if they called as hashPayload([...]) instead of hashPayload(...)
    const args = Array.isArray(zip[0]) ? ((zip[0] as any) as EthArgs) : zip; // tslint:disable-line: no-any

    const types = args.map(param => param.type);
    const values = args.map(param => param.value);

    const message = rawEncode(types, values);
    const digest = keccak256(message);

    if (logger) logger.debug("pHash", toBase64(digest), Ox(message));

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
    logger?: Logger
): Buffer => {
    // Type validation
    assertType<Buffer>("Buffer", { nonce });
    assertType<string>("string", { to, token: tokenIdentifier });

    const pHash = generatePHash(payload, logger);

    const encoded = v2
        ? Buffer.concat([pHash, fromHex(tokenIdentifier), fromHex(to), nonce])
        : rawEncode(
              ["bytes32", "address", "address", "bytes32"],
              [pHash, tokenIdentifier, to, nonce]
          );

    const digest = keccak256(encoded);

    if (logger) {
        logger.debug("gHash", toBase64(digest), Ox(encoded));
    }

    return digest;
};

export const generateNHash = (
    nonce: Buffer,
    txid: Buffer,
    txindex: string,
    v2?: boolean,
    logger?: Logger
): Buffer => {
    const encoded = v2
        ? Buffer.concat([
              nonce,
              txid,
              rawEncode(["uint32"], [txindex]).slice(-4),
          ])
        : rawEncode(["bytes32", "bytes32", "uint32"], [nonce, txid, txindex]);

    const digest = keccak256(encoded);

    if (logger) {
        logger.debug("nHash", toBase64(digest), Ox(encoded));
    }

    return digest;
};

export const generateSighash = (
    pHash: Buffer,
    amount: number | string,
    to: string,
    tokenIdentifier: string,
    nonceHash: Buffer,
    v2?: boolean,
    logger?: Logger
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
        [pHash, amount, Ox(tokenIdentifier), Ox(to), nonceHash]
    );

    const digest = keccak256(encoded);

    if (logger) logger.debug("sigHash", toBase64(digest), Ox(encoded));

    return digest;
};

export const renVMHashToBase64 = (txHash: string) => {
    // Type validation
    assertType<string>("string", { txHash });

    // Hex
    if (txHash.match(/^(0x)?[0-9a-fA-Z]{64}$/)) {
        return toBase64(fromHex(txHash));
    }
    // Already base64
    return txHash;
};

export const generateBurnTxHash = (
    renContract: RenContract,
    encodedID: string,
    logger?: Logger
): Buffer => {
    // Type validation
    assertType<string>("string", { encodedID });

    const message = `txHash_${renContract}_${encodedID}`;
    const digest = keccak256(Buffer.from(message));
    if (logger) logger.debug("Burn txHash", toBase64(digest), message);
    return digest;
};
