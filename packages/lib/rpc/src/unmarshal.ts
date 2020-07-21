import {
    AbiItem, Chain, Fees, RenVMArg, RenVMOutputUTXO, RenVMType, Tokens, UnmarshalledAssetFees,
    UnmarshalledBurnTx, UnmarshalledFees, UnmarshalledMintTx,
} from "@renproject/interfaces";
import { assert, Ox, parseRenContract } from "@renproject/utils";
import BigNumber from "bignumber.js";

import { ResponseQueryBurnTx, ResponseQueryFees, ResponseQueryMintTx } from "./renVMTypes";

const decodeString = (input: string) => Buffer.from(input, "base64").toString();
const decodeBytes = (input: string) => Ox(Buffer.from(input, "base64"));
const decodeNumber = (input: string) => new BigNumber(input);

/**
 * Validate an argument returned from RenVM.
 * @param name The expected name.
 * @param type The expected type.
 * @param arg The actual argument returned.
 */
const assertArgumentType = <ArgType>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value> ? RenVMArg<Name, Type, Value> : never
): ArgType extends RenVMArg<infer _Name, infer _Type, infer Value> ? Value : never => {
    assert(arg.type === type, `Expected argument ${name} of type ${type} but got ${arg.name} of type ${arg.type}`);
    return arg.value;
};

const assertAndDecodeBytes = <ArgType extends RenVMArg<string, RenVMType>>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value> ? Value extends string ? RenVMArg<Name, Type, Value> : never : never
): string => {
    try {
        // tslint:disable-next-line: no-any
        return decodeBytes(assertArgumentType<ArgType>(name as any, type as any, arg as any));
    } catch (error) {
        error.message = `Unable to decode parameter ${name} with value ${arg.value} (type ${typeof arg.value}): ${error.message}`;
        throw error;
    }
};

const assertAndDecodeNumber = <ArgType>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value> ? Value extends string ? RenVMArg<Name, Type, Value> : never : never
): BigNumber => {
    try {
        // tslint:disable-next-line: no-any
        return decodeNumber(assertArgumentType<ArgType>(name as any, type as any, arg as any));
    } catch (error) {
        error.message = `Unable to decode parameter ${name} with value ${arg.value} (type ${typeof arg.value}): ${error.message}`;
        throw error;
    }
};

const assertAndDecodeAddress = <ArgType extends RenVMArg<string, RenVMType>>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value> ? Value extends string ? RenVMArg<Name, Type, Value> : never : never
): string => {
    try {
        // tslint:disable-next-line: no-any
        return Ox(assertArgumentType<ArgType>(name as any, type as any, arg as any));
    } catch (error) {
        error.message = `Unable to decode parameter ${name} with value ${arg.value} (type ${typeof arg.value}): ${error.message}`;
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
    // tslint:disable-next-line: no-any
};

const findField = <ArgType extends RenVMArg<string, RenVMType>>(
    field: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    response: ResponseQueryMintTx,
): ArgType => {

    for (const outField of (response.tx.out || [])) {
        if (outField.name === field) { return outField as ArgType; }
    }

    for (const outField of response.tx.autogen) {
        if (outField.name === field) { return outField as ArgType; }
    }

    for (const outField of response.tx.in) {
        if (outField.name === field) { return outField as ArgType; }
    }

    throw new Error(`Unable to find field ${field} in response from RenVM`);
};

const onError = <P>(getP: () => P, defaultP: P) => {
    try { return getP(); } catch (error) { return defaultP; }
};

export const unmarshalMintTx = (response: ResponseQueryMintTx): UnmarshalledMintTx => {
    // Note: Numbers are decoded and re-encoded to ensure they are in the correct format.

    assert(parseRenContract(response.tx.to).to === Chain.Ethereum, `Expected mint details but got back burn details (${response.tx.hash} - ${response.tx.to})`);

    type In = ResponseQueryMintTx["tx"]["in"];

    const pRaw = assertArgumentType<In[0]>("p", RenVMType.ExtEthCompatPayload, onError(() => findField<In[0]>("p", response), defaultPayload));
    const token = assertAndDecodeAddress<In[1]>("token", RenVMType.ExtTypeEthCompatAddress, findField<In[1]>("token", response));
    const to = assertAndDecodeAddress<In[2]>("to", RenVMType.ExtTypeEthCompatAddress, findField<In[2]>("to", response));
    const n = assertAndDecodeBytes<In[3]>("n", RenVMType.TypeB32, findField<In[3]>("n", response));

    const p = {
        abi: JSON.parse(decodeString(pRaw.abi)) as AbiItem[],
        value: decodeBytes(pRaw.value),
        fn: decodeString(pRaw.fn),
    };

    type Autogen = ResponseQueryMintTx["tx"]["autogen"];
    const phash = assertAndDecodeBytes<Autogen[0]>("phash", RenVMType.TypeB32, findField<Autogen[0]>("phash", response));
    const ghash = assertAndDecodeBytes<Autogen[1]>("ghash", RenVMType.TypeB32, findField<Autogen[1]>("ghash", response));
    const nhash = assertAndDecodeBytes<Autogen[2]>("nhash", RenVMType.TypeB32, findField<Autogen[2]>("nhash", response));
    const amount = assertAndDecodeNumber<Autogen[3]>("amount", RenVMType.TypeU256, findField<Autogen[3]>("amount", response)).toFixed();
    const utxoRaw = assertArgumentType<Autogen[4]>("utxo", RenVMType.ExtTypeBtcCompatUTXO, findField<Autogen[4]>("utxo", response) as RenVMArg<"utxo", RenVMType.ExtTypeBtcCompatUTXO, RenVMOutputUTXO>);
    const sighash = assertAndDecodeBytes<Autogen[5]>("sighash", RenVMType.TypeB32, findField<Autogen[5]>("sighash", response));

    const utxo = { "txHash": decodeBytes(utxoRaw.txHash), "vOut": parseInt(utxoRaw.vOut, 10), "scriptPubKey": utxoRaw.scriptPubKey ? decodeBytes(utxoRaw.scriptPubKey) : "", "amount": decodeNumber(utxoRaw.amount).toFixed() };

    type Out = ResponseQueryMintTx["tx"]["out"] & {};
    let out: UnmarshalledMintTx["out"];
    if (response.tx.out) {
        const [rArg, sArg, vArg] = [findField<Out[0]>("r", response), findField<Out[1]>("s", response), findField<Out[2]>("v", response)];
        const r = rArg.type === RenVMType.TypeB ?
            assertAndDecodeBytes<Out["0"]>("r", RenVMType.TypeB, rArg) :
            assertAndDecodeBytes<Out["0"]>("r", RenVMType.TypeB32, rArg);
        const s = sArg.type === RenVMType.TypeB ?
            assertAndDecodeBytes<Out["1"]>("s", RenVMType.TypeB, sArg) :
            assertAndDecodeBytes<Out["1"]>("s", RenVMType.TypeB32, sArg);
        const v = vArg.type === RenVMType.TypeB ?
            assertAndDecodeBytes<Out["2"]>("v", RenVMType.TypeB, vArg) :
            Ox(assertAndDecodeNumber<Out["2"]>("v", RenVMType.TypeU8, vArg).toString(16));
        out = { r, s, v };
    }

    return {
        hash: decodeBytes(response.tx.hash),
        txStatus: response.txStatus,
        to: response.tx.to,
        in: { p, token, to, n, utxo },
        autogen: { sighash, ghash, nhash, phash, amount },
        out,
    };
};

export const unmarshalBurnTx = (response: ResponseQueryBurnTx): UnmarshalledBurnTx => {

    assert(parseRenContract(response.tx.to).from === Chain.Ethereum, `Expected burn details but got back mint details (${response.tx.hash} - ${response.tx.to})`);

    const [refArg, toArg, amountArg] = response.tx.in;
    const ref = assertAndDecodeNumber<typeof refArg>("ref", RenVMType.TypeU64, refArg).toFixed();
    const toRaw = assertArgumentType<typeof toArg>("to", RenVMType.TypeB, toArg);
    let amount;
    try {
        amount = assertAndDecodeNumber<typeof amountArg>("amount", RenVMType.TypeU256, amountArg).toFixed();
    } catch (error) {
        amount = assertAndDecodeNumber<typeof amountArg>("amount", RenVMType.TypeU64, amountArg).toFixed();
    }

    const to = toRaw;
    // response.tx.to === Tokens.ZEC.Eth2Zec ?
    //     utils.zec.addressFrom(toRaw) :
    //     response.tx.to === Tokens.BCH.Eth2Bch ?
    //         utils.bch.addressFrom(toRaw) :
    //         utils.btc.addressFrom(toRaw);

    return {
        hash: decodeBytes(response.tx.hash),
        to: response.tx.to,
        in: { ref, to, amount },
        txStatus: response.txStatus,
    };
};

export const unmarshalTx = ((response: ResponseQueryMintTx | ResponseQueryBurnTx): UnmarshalledMintTx | UnmarshalledBurnTx => {
    if (parseRenContract(response.tx.to).to === Chain.Ethereum) {
        return unmarshalMintTx(response as ResponseQueryMintTx);
    } else {
        return unmarshalBurnTx(response as ResponseQueryBurnTx);
    }
});

const unmarshalAssetFees = (fees: Fees): UnmarshalledAssetFees => {
    return {
        lock: decodeNumber(fees.lock).toNumber(),
        release: decodeNumber(fees.release).toNumber(),
        ethereum: {
            mint: decodeNumber(fees.ethereum.mint).toNumber(),
            burn: decodeNumber(fees.ethereum.burn).toNumber(),
        }
    };
};

export const unmarshalFees = (response: ResponseQueryFees): UnmarshalledFees => {
    return {
        btc: unmarshalAssetFees(response.btc),
        zec: unmarshalAssetFees(response.zec),
        bch: unmarshalAssetFees(response.bch),
    };
};
