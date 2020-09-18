import {
    Asset,
    BurnAndReleaseParams,
    Chain,
    DepositCommon,
    EthArgs,
    LockAndMintParams,
    Logger,
    RenContract,
} from "@renproject/interfaces";
import BigNumber from "bignumber.js";
import { keccak256 } from "ethereumjs-util";

import { assertType } from "./assert";
import { fromHex, Ox, randomBytes, toBase64, unzip } from "./common";
import { rawEncode } from "./ethereumUtils";

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

    const [types, values] = unzip(args);

    const message = rawEncode(types, values);
    const digest = keccak256(message);

    if (logger) logger.debug("pHash", toBase64(digest), Ox(message));

    return digest; // sha3 can accept a Buffer
};

interface RenContractDetails {
    asset: Asset;
    from: Chain;
    to: Chain;
}

const renContractRegex = /^(.*)0(.*)2(.*)$/;
const defaultMatch = [undefined, undefined, undefined, undefined];

/**
 * parseRenContract splits a RenVM contract (e.g. `BTC0Eth2Btc`) into the asset
 * (`BTC`), the origin chain (`Eth`) and the target chain (`Btc`).
 */
export const parseRenContract = (
    renContract: RenContract
): RenContractDetails => {
    // re.exec("BTC0Eth2Btc") => ['BTC0Eth2Btc', 'BTC', 'Eth', 'Btc']
    const [, asset, from, to] =
        renContractRegex.exec(renContract) || defaultMatch;
    if (!asset || !from || !to) {
        throw new Error(`Invalid Ren Contract "${renContract}"`);
    }

    return {
        asset: asset as Asset,
        from: from as Chain,
        to: to as Chain,
    };
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
    assertType("Buffer", { nonce });
    assertType("string", { to, token: tokenIdentifier });

    const pHash = generatePHash(payload, logger);

    const encoded = rawEncode(
        [
            "bytes32",
            v2 ? "bytes32" : "address",
            v2 ? "bytes" : "address",
            "bytes32",
        ],
        [pHash, tokenIdentifier, to, nonce]
    );

    const digest = keccak256(encoded);

    if (logger) {
        logger.debug("gHash", toBase64(digest), Ox(encoded));
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
    assertType("string", { to, tokenIdentifier });
    assertType("Buffer", { pHash, nonceHash });

    const encoded = rawEncode(
        [
            "bytes32",
            "uint256",
            v2 ? "string" : "address",
            v2 ? "string" : "address",
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
    assertType("string", { txHash });

    // Hex
    if (txHash.match(/^(0x)?[0-9a-fA-Z]{64}$/)) {
        return toBase64(fromHex(txHash));
    }
    // Already base64
    return txHash;
};

export const generateMintTxHash = (
    renContract: RenContract,
    encodedID: string,
    deposit: string,
    logger?: Logger
): Buffer => {
    // Type validation
    assertType("string", { encodedID, deposit });

    const message = `txHash_${renContract}_${encodedID}_${deposit}`;
    const digest = keccak256(Buffer.from(message));
    if (logger) logger.debug("Mint txHash", toBase64(digest), message);
    return digest;
};

export const generateBurnTxHash = (
    renContract: RenContract,
    encodedID: string,
    logger?: Logger
): Buffer => {
    // Type validation
    assertType("string", { encodedID });

    const message = `txHash_${renContract}_${encodedID}`;
    const digest = keccak256(Buffer.from(message));
    if (logger) logger.debug("Burn txHash", toBase64(digest), message);
    return digest;
};

interface Signature {
    r: Buffer;
    s: Buffer;
    v: number;
}

export const signatureToBuffer = <T extends Signature>(sig: T): Buffer =>
    Buffer.concat([sig.r, sig.s, Buffer.from([sig.v])]);

export const signatureToString = <T extends Signature>(sig: T): string =>
    Ox(
        `${Ox(sig.r, { prefix: "" })}${Ox(sig.s, {
            prefix: "",
        })}${sig.v.toString(16)}`
    );

const switchV = (v: number) => (v === 27 ? 28 : 27); // 28 - (v - 27);

const to32Bytes = (bn: BigNumber): Buffer =>
    fromHex(("0".repeat(64) + bn.toString(16)).slice(-64));

const secp256k1n = new BigNumber(
    "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
    16
);
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
    assertType("string", { amount, to, tokenIdentifier });
    assertType("Buffer", { r, s, sigHash, pHash, nHash });

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
        if (logger) {
            logger.warn(
                `Warning: unexpected signature hash returned from RenVM. Expected ${expectedSighash}, got ${sigHash}.`
            );
        }
    }

    let sBN = new BigNumber(Ox(s, { prefix: "" }), 16);
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

    const signature: Signature = {
        r,
        s: to32Bytes(sBN),
        v: vFixed,
    };

    return signature;
};

export const fixSignatureSimple = (
    r: Buffer,
    s: Buffer,
    v: number
): Signature => {
    assertType("Buffer", { r, s });
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

    // TODO: Fix code below to check against proper mintAuthority

    // // Currently, the wrong `v` value may be returned from RenVM. We recover the
    // // address to see if we need to switch `v`. This can be removed once RenVM
    // // has been updated.
    // const recovered = {
    //     [v]: pubToAddress(ecrecover(
    //         fromHex(response.autogen.sighash),
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
    //     console.info("[info][ren-js] switching v value");
    //     v = switchV(v);
    // } else {
    //     throw new Error(`Invalid signature - unable to recover mint authority from signature (Expected ${Ox(expected)}, got ${Ox(recovered[v])})`);
    // }

    const signature: Signature = {
        r,
        s: to32Bytes(sBN),
        v: vFixed,
    };

    return signature;
};

/**
 * Returns a random 32 byte hex string (prefixed with '0x').
 */
export const randomNonce = () => randomBytes(32);

export const resolveInToken = <
    Transaction = {},
    Deposit extends DepositCommon<Transaction> = DepositCommon<Transaction>
>({
    asset,
    from,
    to,
}: {
    asset: LockAndMintParams<Transaction, Deposit>["asset"];
    from: LockAndMintParams<Transaction, Deposit>["from"];
    to: LockAndMintParams<Transaction, Deposit>["to"];
}): RenContract => {
    return `${asset}0${from.name}2${to.name}` as RenContract;
};

export const resolveOutToken = ({
    asset,
    from,
    to,
}: {
    asset: BurnAndReleaseParams["asset"];
    from: BurnAndReleaseParams["from"];
    to: BurnAndReleaseParams["to"];
}): RenContract => {
    return `${asset}0${from.name}2${to.name}` as RenContract;
};

// export const resolveSendTo = <T extends LockAndMintParams | BurnAndReleaseParams>({ isMint }: { isMint: boolean }) => (params: T): typeof params => {
//     params.sendToken = isMint ? resolveInToken(params) : resolveOutToken(params);
//     return params;
// };
