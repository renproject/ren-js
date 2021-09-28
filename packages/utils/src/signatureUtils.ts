import BigNumber from "bignumber.js";

import { assertType } from "./assert";
import { fromHex, Ox } from "./common";

interface Signature {
    r: Buffer;
    s: Buffer;
    v: number;
}

export const signatureToBuffer = <T extends Signature>(sig: T): Buffer =>
    Buffer.concat([sig.r, sig.s, Buffer.from([sig.v])]);

const switchV = (v: number) => (v === 27 ? 28 : 27); // 28 - (v - 27);

const to32Bytes = (bn: BigNumber): Buffer =>
    fromHex(("0".repeat(64) + bn.toString(16)).slice(-64));

export const secp256k1n = new BigNumber(
    "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
    16,
);

export const fixSignatureSimple = (
    r: Buffer,
    s: Buffer,
    v: number,
): Signature => {
    assertType<Buffer>("Buffer", { r, s });
    let sBN = new BigNumber(Ox(s), 16);
    let vFixed = ((v || 0) % 27) + 27;

    // For a given key, there are two valid signatures for each signed message.
    // We always take the one with the lower `s`.
    // secp256k1n/2 = 57896044618658097711785492504343953926418782139537452191302581570759080747168.5
    if (sBN.gt(secp256k1n.div(2))) {
        // Take s = -s % secp256k1n
        sBN = secp256k1n.minus(sBN);
        // Switch v
        vFixed = switchV(vFixed);
    }

    return {
        r,
        s: to32Bytes(sBN),
        v: vFixed,
    };
};
