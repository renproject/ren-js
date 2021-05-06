import {
    BurnAndReleaseTransaction,
    LockAndMintTransaction,
} from "@renproject/interfaces";
import {
    assert,
    fixSignatureSimple,
    signatureToBuffer,
} from "@renproject/utils";

import { ResponseQueryTx } from "./methods";
import { unmarshalTypedPackValue } from "./pack/pack";

export const unmarshalMintTx = (
    response: ResponseQueryTx,
): LockAndMintTransaction => {
    // Note: Numbers are decoded and re-encoded to ensure they are in the correct format.

    assert(
        /\/to/.exec(response.tx.selector) !== null,
        `Expected mint details but got back burn details (${response.tx.hash} - ${response.tx.selector})`,
    );

    let out;

    const inValue = unmarshalTypedPackValue(response.tx.in);

    if (response.tx.out) {
        out = unmarshalTypedPackValue(response.tx.out);

        // Temporary fix to support v0.4.
        if (out.revert && out.revert.length === 0) {
            out.revert = undefined;
        }

        if (out.sig) {
            const [r, s, v] = [
                out.sig.slice(0, 32),
                out.sig.slice(32, 64),
                out.sig[64] % 27,
            ];
            out.signature = signatureToBuffer(fixSignatureSimple(r, s, v));
            out.nhash = inValue.nhash;
        }
    }

    return {
        hash: response.tx.hash,
        txStatus: response.txStatus,
        to: response.tx.selector,
        in: inValue,
        out,
    };
};

export const unmarshalBurnTx = (
    response: ResponseQueryTx,
): BurnAndReleaseTransaction => {
    assert(
        /\/from/.exec(response.tx.selector) !== null,
        `Expected burn details but got back mint details (${response.tx.hash} - ${response.tx.selector})`,
    );

    let out;

    if (response.tx.out) {
        out = unmarshalTypedPackValue(response.tx.out);
    }

    return {
        hash: response.tx.hash,
        to: response.tx.selector,
        in: unmarshalTypedPackValue(response.tx.in),
        txStatus: response.txStatus,
        out,
    };
};

// const unmarshalAssetFees = (fees: Fees): RenVMAssetFees => {
//     const { lock, release, ...tokens } = fees;

//     // TODO: Fix type errors.
//     return ({
//         lock: decodeNumber(lock).toNumber(),
//         release: decodeNumber(release).toNumber(),
//         ...Object.keys(tokens).reduce(
//             (acc, token) => ({
//                 ...acc,
//                 [token]: {
//                     mint: decodeNumber(fees[token].mint).toNumber(),
//                     burn: decodeNumber(fees[token].burn).toNumber(),
//                 },
//             }),
//             {},
//         ),
//     } as unknown) as RenVMAssetFees;
// };

// export const unmarshalFees = (response: ResponseQueryFees): RenVMFees => {
//     const fees = {};
//     for (const key of Object.keys(response)) {
//         fees[key] = unmarshalAssetFees(response[key]);
//     }
//     return fees;
// };
