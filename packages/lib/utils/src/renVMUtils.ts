import {
  Asset,
  Chain,
  EthArgs,
  Logger,
  RenContract,
  TransferParamsCommon,
  UnmarshalledMintTx,
} from "@renproject/interfaces";
import BigNumber from "bignumber.js";
import { keccak256 } from "ethereumjs-util";

import { Ox, randomBytes, strip0x, unzip } from "./common";
import { rawEncode } from "./ethereumUtils";

// export const generateNHash = (tx: Tx): string => {
//     const encoded = rawEncode(
//         ["bytes32", "bytes32"],
//         [Ox(tx.hash), Ox(tx.args.n)],
//     );

//     return Ox(keccak256(encoded));
// };

/**
 * Hash the payloads associated with a RenVM cross-chain transaction.
 *
 * @param zip An array (or spread) of parameters with with types defined.
 */
export const generatePHash = (zip: EthArgs, logger?: Logger): string => {
    // Check if they called as hashPayload([...]) instead of hashPayload(...)
    const args = Array.isArray(zip[0]) ? ((zip[0] as any) as EthArgs) : zip; // tslint:disable-line: no-any

    const [types, values] = unzip(args);

    const message = rawEncode(types, values);
    const digest = Ox(keccak256(message));

    if (logger) logger.debug("pHash", digest, message.toString("hex"));

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
    /* amount: number | string, */
    to: string,
    token: string,
    nonce: string,
    logger?: Logger
): Buffer => {
    const pHash = generatePHash(payload, logger);

    const encoded = rawEncode(
        ["bytes32", /*"uint256",*/ "address", "bytes32", "bytes32"],
        [Ox(pHash), /*amount,*/ Ox(token), Ox(to), Ox(nonce)]
    );

    const digest = keccak256(encoded);

    if (logger) logger.debug("gHash", digest, encoded.toString("hex"));

    return digest;
};

export const generateSighash = (
    pHash: string,
    amount: number | string,
    to: string,
    token: string,
    nonceHash: string,
    logger?: Logger
): string => {
    const encoded = rawEncode(
        ["bytes32", "uint256", "address", "bytes32", "bytes32"],
        [Ox(pHash), amount, token, to, nonceHash]
    );

    const digest = Ox(keccak256(encoded));

    if (logger) logger.debug("sigHash", digest, encoded.toString("hex"));

    return digest;
};

export const txHashToBase64 = (txHash: Buffer | string) => {
    if (Buffer.isBuffer(txHash)) {
        return txHash.toString("base64");
    }

    // Check if it's hex-encoded
    if (txHash.match(/^(0x)?[0-9a-fA-Z]{64}$/)) {
        return Buffer.from(strip0x(txHash), "hex").toString("base64");
    }
    return txHash;
};

export const generateMintTxHash = (
    renContract: RenContract,
    encodedID: string,
    deposit: string,
    logger?: Logger
) => {
    const message = `txHash_${renContract}_${encodedID}_${deposit}`;
    const digest = txHashToBase64(keccak256(Buffer.from(message)));
    if (logger) logger.debug("Mint txHash", digest, message);
    return digest;
};

export const generateBurnTxHash = (
    renContract: RenContract,
    encodedID: string,
    logger?: Logger
) => {
    const message = `txHash_${renContract}_${encodedID}`;
    const digest = txHashToBase64(keccak256(Buffer.from(message)));
    if (logger) logger.debug("Burn txHash", digest, message);
    return digest;
};

// export const generateNHash = (tx: Tx): string => {
//     const encoded = rawEncode(
//         ["bytes32", "bytes32"],
//         [Ox(tx.hash), Ox(tx.args.n)],
//     );

//     return Ox(keccak256(encoded));
// };

interface Signature {
    r: string;
    s: string;
    v: number;
}

export const signatureToString = <T extends Signature>(sig: T): string =>
    Ox(`${strip0x(sig.r)}${sig.s}${sig.v.toString(16)}`);

const switchV = (v: number) => (v === 27 ? 28 : 27); // 28 - (v - 27);

const secp256k1n = new BigNumber(
    "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
    16
);
export const fixSignature = (
    response: UnmarshalledMintTx,
    logger?: Logger
): Signature => {
    if (!response.out) {
        throw new Error(`Expected transaction response to have signature`);
    }

    const expectedSighash = generateSighash(
        response.autogen.phash,
        response.autogen.amount,
        response.in.token,
        response.to,
        response.autogen.nhash,
        logger
    );
    if (Ox(response.autogen.sighash) !== Ox(expectedSighash)) {
        if (logger)
            logger.warn(
                `Warning: RenVM returned invalid signature hash. Expected ${expectedSighash} but for ${response.autogen.sighash}`
            );
    }

    const r = response.out.r;
    let s = new BigNumber(strip0x(response.out.s), 16);
    let v =
        ((new BigNumber(strip0x(response.out.v) || "0", 16).toNumber() || 0) %
            27) +
        27;

    // For a given key, there are two valid signatures for each signed message.
    // We always take the one with the lower `s`.
    // secp256k1n/2 = 57896044618658097711785492504343953926418782139537452191302581570759080747168.5
    if (s.gt(secp256k1n.div(2))) {
        // Take s = -s % secp256k1n
        s = secp256k1n.minus(s);
        // Switch v
        v = switchV(v);
    }

    // TODO: Fix code below to check against proper mintAuthority

    // // Currently, the wrong `v` value may be returned from RenVM. We recover the
    // // address to see if we need to switch `v`. This can be removed once RenVM
    // // has been updated.
    // const recovered = {
    //     [v]: pubToAddress(ecrecover(
    //         Buffer.from(strip0x(response.autogen.sighash), "hex"),
    //         v,
    //         Buffer.from(strip0x(r), "hex"),
    //         s.toArrayLike(Buffer, "be", 32),
    //     )),

    //     [switchV(v)]: pubToAddress(ecrecover(
    //         Buffer.from(strip0x(response.autogen.sighash), "hex"),
    //         switchV(v),
    //         Buffer.from(strip0x(r), "hex"),
    //         s.toArrayLike(Buffer, "be", 32),
    //     )),
    // };

    // const expected = Buffer.from(strip0x(.network.renVM.mintAuthority), "hex");
    // if (recovered[v].equals(expected)) {
    //     // Do nothing
    // } else if (recovered[switchV(v)].equals(expected)) {
    //     // tslint:disable-next-line: no-console
    //     console.info("[info][ren-js] switching v value");
    //     v = switchV(v);
    // } else {
    //     throw new Error(`Invalid signature - unable to recover mint authority from signature (Expected ${Ox(expected)}, got ${Ox(recovered[v])})`);
    // }

    const to32Bytes = (bn: BigNumber) =>
        ("0".repeat(64) + bn.toString(16)).slice(-64);

    const signature: Signature = {
        r,
        s: to32Bytes(s),
        v,
    };

    return signature;
};

/**
 * Returns a random 32 byte hex string (prefixed with '0x').
 */
export const randomNonce = () => randomBytes(32);

export const resolveInToken = ({
    asset,
    from,
    to,
}: {
    asset: TransferParamsCommon["asset"];
    from: TransferParamsCommon["from"];
    to: TransferParamsCommon["to"];
}): RenContract => {
    return `${asset}0${from.name}2${to.name}` as RenContract;
};

export const resolveOutToken = ({
    asset,
    from,
    to,
}: {
    asset: TransferParamsCommon["asset"];
    from: TransferParamsCommon["from"];
    to: TransferParamsCommon["to"];
}): RenContract => {
    return `${asset}0${from.name}2${to.name}` as RenContract;
};

// export const resolveSendTo = <T extends LockAndMintParams | BurnAndReleaseParams>({ isMint }: { isMint: boolean }) => (params: T): typeof params => {
//     params.sendToken = isMint ? resolveInToken(params) : resolveOutToken(params);
//     return params;
// };
