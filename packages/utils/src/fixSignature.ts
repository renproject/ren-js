import BigNumber from "bignumber.js";

import { assertType } from "./assert";
import { toNBytes } from "./common";
import { Ox } from "./encodings";

/**
 * Normalize the `s` and `v` values of the signature.
 */
export const fixSignature = (signature: Buffer): Buffer => {
    assertType<Buffer>("Buffer", { signature });

    const r: Buffer = signature.slice(0, 32);
    const s: Buffer = signature.slice(32, 64);
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

    return Buffer.concat([r, toNBytes(sBN, 32), Buffer.from([v])]);
};
