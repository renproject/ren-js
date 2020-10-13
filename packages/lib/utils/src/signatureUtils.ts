import { Logger } from "@renproject/interfaces";
import BigNumber from "bignumber.js";

import { assertType } from "./assert";
import { fromHex, Ox } from "./common";
import { generateSighash } from "./renVMHashes";

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
    16
);

export const fixSignatureSimple = (
    r: Buffer,
    s: Buffer,
    v: number
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

export const fixSignature = (
    r: Buffer,
    s: Buffer,
    v: number,
    sigHash: Buffer,
    pHash: Buffer,
    amount: string,
    to: string,
    tokenIdentifier: string,
    nHash: Buffer,
    v2?: boolean,
    logger?: Logger
): Signature => {
    // Type validation
    assertType<string>("string", { amount, to, tokenIdentifier });
    assertType<Buffer>("Buffer", { r, s, sigHash, pHash, nHash });

    if (logger) {
        const expectedSighash = generateSighash(
            pHash,
            amount,
            to,
            tokenIdentifier,
            nHash,
            v2,
            logger
        );
        if (Ox(sigHash) !== Ox(expectedSighash)) {
            logger.warn(
                `Warning: unexpected signature hash returned from RenVM. Expected ${expectedSighash}, got ${sigHash}.`
            );
        }
    }

    // TODO: Fix code below to check against proper mintAuthority

    // // Currently, the wrong `v` value may be returned from RenVM. We recover the
    // // address to see if we need to switch `v`. This can be removed once RenVM
    // // has been updated.
    // const recovered = {
    //     [v]: pubToAddress(ecrecover(
    //         fromHex(response.autogen.sighash)),
    //         v,
    //         fromHex(r),
    //         s.toArrayLike(Buffer, "be", 32),
    //     )),

    //     [switchV(v)]: pubToAddress(ecrecover(
    //         fromHex(response.autogen.sighash),
    //         switchV(v),
    //         fromHex(r),
    //         s.toArrayLike(Buffer, "be", 32),
    //     )),
    // };

    // const expected = fromHex(.network.renVM.mintAuthority);
    // if (recovered[v].equals(expected)) {
    //     // Do nothing
    // } else if (recovered[switchV(v)].equals(expected)) {
    //     // tslint:disable-next-line: no-console
    //     console.info("[info][ren-js] switching v value");
    //     v = switchV(v);
    // } else {
    //     throw new Error(`Invalid signature - unable to recover mint authority from signature (Expected ${Ox(expected)}, got ${Ox(recovered[v])})`);
    // }

    return fixSignatureSimple(r, s, v);
};
