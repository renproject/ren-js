import createHash from "create-hash";

import { assertType } from "@renproject/utils";

import { marshalString, marshalTypedPackValue } from "./pack/marshal";
import { PackPrimitive, PackTypeDefinition, TypedPackValue } from "./pack/pack";
import { RenVMType, RenVMValue } from "./value";

export interface TransactionInput<Input extends TypedPackValue> {
    hash: string;
    version: string;
    selector: string;
    in: Input;
}

export interface TransactionOutput<
    Input extends TypedPackValue,
    Output extends TypedPackValue,
> extends TransactionInput<Input> {
    out: Output;
}

export interface RPCValue<Types extends PackTypeDefinition, Values> {
    t: Types;
    v: Values;
}

export type EmptyRPCStruct = RPCValue<{ struct: [] }, {}>;

export const burnParamsType: PackTypeDefinition = {
    struct: [
        {
            amount: PackPrimitive.U256,
        },
        {
            to: PackPrimitive.Str,
        },
        {
            nonce: PackPrimitive.Bytes32,
        },
    ],
};

export const crossChainParamsType: PackTypeDefinition = {
    struct: [
        {
            txid: PackPrimitive.Bytes,
        },
        {
            txindex: PackPrimitive.U32,
        },
        {
            amount: PackPrimitive.U256,
        },
        {
            payload: PackPrimitive.Bytes,
        },
        {
            phash: PackPrimitive.Bytes32,
        },
        {
            to: PackPrimitive.Str,
        },
        {
            nonce: PackPrimitive.Bytes32,
        },
        {
            nhash: PackPrimitive.Bytes32,
        },
        {
            gpubkey: PackPrimitive.Bytes,
        },
        {
            ghash: PackPrimitive.Bytes32,
        },
    ],
};

export type CrossChainParams = RPCValue<
    // Types
    typeof crossChainParamsType,
    // Values
    {
        amount: RenVMValue<RenVMType.U256>;
        ghash: RenVMValue<RenVMType.B32>; // "x0gTBzbXmM1Xdwk-B8PHJ4sgY2T_NcrWsxK6MJ2xYos",
        gpubkey: RenVMValue<RenVMType.B>; // "8Qnq",
        nhash: RenVMValue<RenVMType.B32>; // "a_46LkThVhVYlkIxBXaInubuEmYcfDNk45EBl60prhA",
        nonce: RenVMValue<RenVMType.B32>; // "vPIiF6apzdJ4Rr8IMpT2uywo8LbuHOcaEXQ21ydXFBA",
        payload: RenVMValue<RenVMType.B>; // "I_9MVtYiO4NlH7lwIx8",
        phash: RenVMValue<RenVMType.B32>; // "ibSvPHswcsI3o3nkQRpHp23ANg3tf9L5ivk5kKwnGTQ",
        to: RenVMValue<RenVMType.Str>; // "򝊞􋄛𧚞󥫨򨚘󳽈򤙳񙓻򳳱􎖫򗣌𻄭񑦁򏬰񆆅򒒛􊗓𧜿򇞣􁓹",
        txid: RenVMValue<RenVMType.B>;
        txindex: RenVMValue<RenVMType.U32>;
    }
>;

export type CrossChainTransactionInput = TransactionInput<CrossChainParams>;

export const submitGatewayType: PackTypeDefinition = {
    struct: [
        {
            payload: PackPrimitive.Bytes,
        },
        {
            phash: PackPrimitive.Bytes32,
        },
        {
            to: PackPrimitive.Str,
        },
        {
            nonce: PackPrimitive.Bytes32,
        },
        {
            nhash: PackPrimitive.Bytes32,
        },
        {
            gpubkey: PackPrimitive.Bytes,
        },
        {
            ghash: PackPrimitive.Bytes32,
        },
    ],
};

export type SubmitGateway = RPCValue<
    // Types
    typeof submitGatewayType,
    // Values
    {
        amount: RenVMValue<RenVMType.U256>;
        ghash: RenVMValue<RenVMType.B32>; // "x0gTBzbXmM1Xdwk-B8PHJ4sgY2T_NcrWsxK6MJ2xYos",
        gpubkey: RenVMValue<RenVMType.B>; // "8Qnq",
        nhash: RenVMValue<RenVMType.B32>; // "a_46LkThVhVYlkIxBXaInubuEmYcfDNk45EBl60prhA",
        nonce: RenVMValue<RenVMType.B32>; // "vPIiF6apzdJ4Rr8IMpT2uywo8LbuHOcaEXQ21ydXFBA",
        payload: RenVMValue<RenVMType.B>; // "I_9MVtYiO4NlH7lwIx8",
        phash: RenVMValue<RenVMType.B32>; // "ibSvPHswcsI3o3nkQRpHp23ANg3tf9L5ivk5kKwnGTQ",
        to: RenVMValue<RenVMType.Str>; // "򝊞􋄛𧚞󥫨򨚘󳽈򤙳񙓻򳳱􎖫򗣌𻄭񑦁򏬰񆆅򒒛􊗓𧜿򇞣􁓹",
        txid: RenVMValue<RenVMType.B>;
        txindex: RenVMValue<RenVMType.U32>;
    }
>;

export interface SubmitGatewayInput {
    version: string;
    selector: string;
    in: SubmitGateway;
}

/**
 * Calculate the hash of a RenVM transaction.
 */
export const hashTransaction = (
    version: string,
    selector: string,
    packValue: TypedPackValue,
): Buffer => {
    assertType<string>("string", { version, selector });
    return createHash("sha256")
        .update(
            Buffer.concat([
                marshalString(version),
                marshalString(selector),
                marshalTypedPackValue(packValue),
            ]),
        )
        .digest();
};
