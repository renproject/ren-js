import {
    AbiItem,
    BurnAndReleaseTransaction,
    LockAndMintTransaction,
    Logger,
    NullLogger,
    RenVMAssetFees,
    RenVMFees,
} from "@renproject/interfaces";
import {
    assert,
    fixSignature,
    fromBase64,
    Ox,
    signatureToBuffer,
    toBase64,
} from "@renproject/utils";
import BigNumber from "bignumber.js";

import {
    ResponseQueryBurnTx,
    ResponseQueryFees,
    ResponseQueryMintTx,
} from "./methods";
import { Fees, RenVMArg, RenVMType } from "./value";

const decodeString = (input: string) => fromBase64(input).toString();
const decodeBytes = (input: string) => fromBase64(input);
const decodeNumber = (input: string) => new BigNumber(input);

/**
 * Validate an argument returned from RenVM.
 *
 * @param name The expected name.
 * @param type The expected type.
 * @param arg The actual argument returned.
 */
const assertArgumentType = <ArgType>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value>
        ? RenVMArg<Name, Type, Value>
        : never,
): ArgType extends RenVMArg<infer _Name, infer _Type, infer Value>
    ? Value
    : never => {
    assert(
        arg.type === type,
        `Expected argument ${name} of type ${type} but got ${arg.name} of type ${arg.type}`,
    );
    return arg.value;
};

const assertAndDecodeBytes = <ArgType extends RenVMArg<string, RenVMType>>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value>
        ? Value extends string
            ? RenVMArg<Name, Type, Value>
            : never
        : never,
): Buffer => {
    try {
        return decodeBytes(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            assertArgumentType<ArgType>(name as any, type as any, arg as any),
        );
    } catch (error) {
        error.message = `Unable to decode parameter ${name} with value ${String(
            arg.value,
        )} (type ${typeof arg.value}): ${String(error.message)}`;
        throw error;
    }
};

const assertAndDecodeNumber = <ArgType>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value>
        ? Value extends string
            ? RenVMArg<Name, Type, Value>
            : never
        : never,
): BigNumber => {
    try {
        return decodeNumber(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            assertArgumentType<ArgType>(name as any, type as any, arg as any),
        );
    } catch (error) {
        error.message = `Unable to decode parameter ${name} with value ${String(
            arg.value,
        )} (type ${typeof arg.value}): ${String(error.message)}`;
        throw error;
    }
};

const assertAndDecodeAddress = <ArgType extends RenVMArg<string, RenVMType>>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value>
        ? Value extends string
            ? RenVMArg<Name, Type, Value>
            : never
        : never,
): string => {
    try {
        return Ox(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            assertArgumentType<ArgType>(name as any, type as any, arg as any),
        );
    } catch (error) {
        error.message = `Unable to decode parameter ${name} with value ${String(
            arg.value,
        )} (type ${typeof arg.value}): ${String(error.message)}`;
        throw error;
    }
};

const defaultPayload: ResponseQueryMintTx["tx"]["in"]["0"] = {
    name: "p",
    type: RenVMType.ExtEthCompatPayload,
    value: {
        abi: "W10=",
        value: "",
        fn: "",
    },
};

const findField = <ArgType extends RenVMArg<string, RenVMType>>(
    field: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    response: ResponseQueryMintTx,
): ArgType => {
    for (const outField of response.tx.out || []) {
        if (outField.name === field) {
            return outField as ArgType;
        }
    }

    for (const outField of response.tx.autogen) {
        if (outField.name === field) {
            return outField as ArgType;
        }
    }

    for (const outField of response.tx.in) {
        if (outField.name === field) {
            return outField as ArgType;
        }
    }

    throw new Error(`Unable to find field ${field} in response from RenVM.`);
};

const onError = <P>(getP: () => P, defaultP: P) => {
    try {
        return getP();
    } catch (error) {
        return defaultP;
    }
};

export const unmarshalMintTx = (
    response: ResponseQueryMintTx,
    logger: Logger = NullLogger,
): LockAndMintTransaction => {
    // Note: Numbers are decoded and re-encoded to ensure they are in the correct format.

    // TODO: Check that response is mint response.
    // assert(
    //     parseV1Selector(response.tx.to).to === "Eth",
    //     `Expected mint details but got back burn details (${response.tx.hash} - ${response.tx.to})`
    // );

    type In = ResponseQueryMintTx["tx"]["in"];

    const pRaw = assertArgumentType<In[0]>(
        "p",
        RenVMType.ExtEthCompatPayload,
        onError(() => findField<In[0]>("p", response), defaultPayload),
    );
    const token = assertAndDecodeAddress<In[1]>(
        "token",
        RenVMType.ExtTypeEthCompatAddress,
        findField<In[1]>("token", response),
    );
    const to = assertAndDecodeAddress<In[2]>(
        "to",
        RenVMType.ExtTypeEthCompatAddress,
        findField<In[2]>("to", response),
    );
    const n = assertAndDecodeBytes<In[3]>(
        "n",
        RenVMType.B32,
        findField<In[3]>("n", response),
    );

    const p = {
        abi: JSON.parse(decodeString(pRaw.abi)) as AbiItem[],
        value: decodeBytes(pRaw.value),
        fn: decodeString(pRaw.fn),
    };

    type Autogen = ResponseQueryMintTx["tx"]["autogen"];
    const phash = assertAndDecodeBytes<Autogen[0]>(
        "phash",
        RenVMType.B32,
        findField<Autogen[0]>("phash", response),
    );
    const ghash = assertAndDecodeBytes<Autogen[1]>(
        "ghash",
        RenVMType.B32,
        findField<Autogen[1]>("ghash", response),
    );
    const nhash = assertAndDecodeBytes<Autogen[2]>(
        "nhash",
        RenVMType.B32,
        findField<Autogen[2]>("nhash", response),
    );
    const amount = assertAndDecodeNumber<Autogen[3]>(
        "amount",
        RenVMType.U256,
        findField<Autogen[3]>("amount", response),
    ).toFixed();
    const utxoRaw = assertArgumentType<Autogen[4]>(
        "utxo",
        RenVMType.ExtTypeBtcCompatUTXO,
        findField<Autogen[4]>("utxo", response),
    );
    const sighash = assertAndDecodeBytes<Autogen[5]>(
        "sighash",
        RenVMType.B32,
        findField<Autogen[5]>("sighash", response),
    );

    const utxo = {
        txHash: Ox(decodeBytes(utxoRaw.txHash), { prefix: "" }),
        vOut: parseInt(utxoRaw.vOut, 10),
        scriptPubKey: utxoRaw.scriptPubKey
            ? Ox(decodeBytes(utxoRaw.scriptPubKey), { prefix: "" })
            : "",
        amount: decodeNumber(utxoRaw.amount).toFixed(),
    };

    type Out = ResponseQueryMintTx["tx"]["out"] & {};
    const out: LockAndMintTransaction["out"] = {
        sighash,
        ghash,
        nhash,
        phash,
        amount,
    };

    if (response.tx.out) {
        const [rArg, sArg, vArg] = [
            findField<Out[0]>("r", response),
            findField<Out[1]>("s", response),
            findField<Out[2]>("v", response),
        ];
        const r: Buffer =
            rArg.type === RenVMType.B
                ? assertAndDecodeBytes<Out["0"]>("r", RenVMType.B, rArg)
                : assertAndDecodeBytes<Out["0"]>("r", RenVMType.B32, rArg);
        const s: Buffer =
            sArg.type === RenVMType.B
                ? assertAndDecodeBytes<Out["1"]>("s", RenVMType.B, sArg)
                : assertAndDecodeBytes<Out["1"]>("s", RenVMType.B32, sArg);
        const v: number =
            vArg.type === RenVMType.B
                ? assertAndDecodeBytes<Out["2"]>("v", RenVMType.B, vArg)[0]
                : assertAndDecodeNumber<Out["2"]>(
                      "v",
                      RenVMType.U8,
                      vArg,
                  ).toNumber();

        const signature = signatureToBuffer(
            fixSignature(
                r,
                s,
                v,
                sighash,
                phash,
                amount,
                to,
                token,
                nhash,
                false,
                logger,
            ),
        );

        out.signature = signature; // r, s, v
    }

    return {
        hash: toBase64(decodeBytes(response.tx.hash)),
        txStatus: response.txStatus,
        to: response.tx.to,
        in: { p, token, to, n, utxo },
        out,
    };
};

export const unmarshalBurnTx = (
    response: ResponseQueryBurnTx,
): BurnAndReleaseTransaction => {
    // TODO: Check that result is burn response.
    // assert(
    //     parseV1Selector(response.tx.to).from === Chain.Ethereum,
    //     `Expected burn details but got back mint details (${response.tx.hash} - ${response.tx.to})`
    // );

    const [refArg, toArg, amountArg] = response.tx.in;
    const ref = assertAndDecodeNumber<typeof refArg>(
        "ref",
        RenVMType.U64,
        refArg,
    ).toFixed();
    const toRaw = assertArgumentType<typeof toArg>("to", RenVMType.B, toArg);
    let amount;
    try {
        amount = assertAndDecodeNumber<typeof amountArg>(
            "amount",
            RenVMType.U256,
            amountArg,
        ).toFixed();
    } catch (error) {
        amount = assertAndDecodeNumber<typeof amountArg>(
            "amount",
            RenVMType.U64,
            amountArg,
        ).toFixed();
    }

    const to = toRaw;
    // response.tx.to === Tokens.ZEC.Eth2Zec ?
    //     utils.zec.addressFrom(toRaw) :
    //     response.tx.to === Tokens.BCH.Eth2Bch ?
    //         utils.bch.addressFrom(toRaw) :
    //         utils.btc.addressFrom(toRaw);

    return {
        hash: toBase64(decodeBytes(response.tx.hash)),
        to: response.tx.to,
        in: { ref, to, amount },
        txStatus: response.txStatus,
    };
};

const unmarshalAssetFees = (fees: Fees): RenVMAssetFees => {
    const { lock, release, ...tokens } = fees;

    // TODO: Fix type errors.
    return ({
        lock: decodeNumber(lock),
        release: decodeNumber(release),
        ...Object.keys(tokens).reduce(
            (acc, token) => ({
                ...acc,
                [token]: {
                    mint: decodeNumber(fees[token].mint).toNumber(),
                    burn: decodeNumber(fees[token].burn).toNumber(),
                },
            }),
            {},
        ),
    } as unknown) as RenVMAssetFees;
};

export const unmarshalFees = (response: ResponseQueryFees): RenVMFees => {
    const fees = {};
    for (const key of Object.keys(response)) {
        fees[key] = unmarshalAssetFees(response[key]);
    }
    return fees;
};
