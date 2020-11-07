import { assertType, sha256 } from "@renproject/utils";

import { marshalString, marshalTypedPackValue } from "./pack/marshal";
import { PackPrimitive, PackStructType, TypedPackValue } from "./pack/pack";
import { RenVMType, RenVMValue } from "./value";

export interface TransactionInput<Input> {
    hash: string;
    version: string;
    selector: string; // "BTC/fromEthereum",
    in: Input;
}

export interface TransactionOutput<Input, Output>
    extends TransactionInput<Input> {
    hash: string; // "fD273Yvy16j4DN4xYaqn4PdMlecFMaizFEldYhbGsbk",
    out: Output;
}

export interface RPCValue<Types, Values> {
    t: Types;
    v: Values;
}

export type EmptyRPCStruct = RPCValue<{ struct: [] }, {}>;

export const burnParamsType: PackStructType = {
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

export type BurnParams = RPCValue<
    // Types
    typeof burnParamsType,
    // Values
    {
        amount: RenVMValue<RenVMType.U256>; // "78176031223228949374118281478848818002695062229035954382782001433280732357353",
        to: RenVMValue<RenVMType.Str>; // "򔿺󢰺𳍚󤐭񵄔󘄯췇򺟒񨒘󊰲񱴬𭑊򊹴󧙵å񺢏𒪤󜟵󒌗򭦶𰌽󺝥󫶪񞣻􇌙񃄥󃒃변򶲛񙾿񽆆򍙂󂺧񞀰󯲺󖌻𸙩𓾬",
        nonce: RenVMValue<RenVMType.B32>; // "GWsi_pwKD1KHsz9H1wXdn2aHtWuJOG2S-XgnShYPr3E",
    }
>;

export type BurnTransactionInput = TransactionInput<BurnParams>;

export const mintParamsType = (): PackStructType => ({
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
        // {
        //     payload: PackPrimitive.Bytes
        // },
        // {
        //     phash: PackPrimitive.Bytes32
        // },
        // {
        //     to: PackPrimitive.String
        // },
        // // {
        // //     nonce: PackPrimitive.Bytes32,
        // // },
        // {
        //     nhash: PackPrimitive.Bytes32
        // },
        // {
        //     gpubkey: PackPrimitive.Bytes
        // },
        // {
        //     ghash: PackPrimitive.Bytes32
        // },
    ],
});

export type MintParams = RPCValue<
    // Types
    typeof mintParamsType,
    // Values
    {
        ghash: RenVMValue<RenVMType.B32>; // "x0gTBzbXmM1Xdwk-B8PHJ4sgY2T_NcrWsxK6MJ2xYos",
        gpubkey: RenVMValue<RenVMType.B>; // "8Qnq",
        nhash: RenVMValue<RenVMType.B32>; // "a_46LkThVhVYlkIxBXaInubuEmYcfDNk45EBl60prhA",
        nonce: RenVMValue<RenVMType.B32>; // "vPIiF6apzdJ4Rr8IMpT2uywo8LbuHOcaEXQ21ydXFBA",
        payload: RenVMValue<RenVMType.B>; // "I_9MVtYiO4NlH7lwIx8",
        phash: RenVMValue<RenVMType.B32>; // "ibSvPHswcsI3o3nkQRpHp23ANg3tf9L5ivk5kKwnGTQ",
        to: RenVMValue<RenVMType.Str>; // "򝊞􋄛𧚞󥫨򨚘󳽈򤙳񙓻򳳱􎖫򗣌𻄭񑦁򏬰񆆅򒒛􊗓𧜿򇞣􁓹",
    } & (
        | {
              output: {
                  outpoint: {
                      hash: RenVMValue<RenVMType.B>; // "_yJG1tKIALMrvaSes9BB4dYx5eCN8OK5V_PEM4N3R10",
                      index: RenVMValue<RenVMType.U32>; // "2288363171"
                  };
                  pubKeyScript: RenVMValue<RenVMType.B>; // "8SsHPc0wCbrItrmmFOsebOtGwd8YOSDTFyaGT7UZHRVGCtEjv0_N17kNJ5RqF8nxzbddbqELUOjxZe3n_llGksd7sEMbQg",
                  value: RenVMValue<RenVMType.U256>; // "503863382662879832"
              };
          }
        | {
              txid: string;
          }
    )
>;

export type MintTransactionInput = TransactionInput<MintParams>;

export const hashTransaction = (
    version: string,
    selector: string,
    packValue: TypedPackValue,
) => {
    assertType<string>("string", { version, selector });
    return sha256(
        Buffer.concat([
            marshalString(version),
            marshalString(selector),
            marshalTypedPackValue(packValue),
        ]),
    );
};
