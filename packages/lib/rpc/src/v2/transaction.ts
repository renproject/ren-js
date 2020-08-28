import { PackPrimitive, PackStruct, PackType } from "./pack";
import { RenVMType, RenVMValue } from "./value";

export interface TransactionInput<Input> {
    version: string; // "",
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

export const burnParamsType: PackStruct = {
    struct: [
        {
            amount: PackPrimitive.U256,
        },
        {
            token: PackPrimitive.String,
        },
        {
            to: PackPrimitive.String,
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
        token: RenVMValue<RenVMType.Str>; // "􈶙񄈐񟖀龺򩱜񙱪󯎰􎽡򃴏􁇟򱫚񖋯󅦔񀍓󃻠򀐽󆑵򠻵򷄿򮹩񌧀󓪸󥃡򂀇񬄷󐮕򐘜󻓜쐈򦮎𮨼🳍򰉎񪉢򫨜󓨻񞖫󍱸𓦒񻰕煖􁵂򾫋񦤺𬲼򇜟򇒪ᚠ𐅅񑑒∝󄋞󧫝𤫬󹎕񹝜񚔊򵥸󂁇𽺿򚧽􉉣𲭃򂡂񣨙񷮪󆽅󰖴󈗪񠕨󾱺񛙸󼒛󬁀𽿺򸑫󓓭"
        to: RenVMValue<RenVMType.Str>; // "򔿺󢰺𳍚󤐭񵄔󘄯췇򺟒񨒘󊰲񱴬𭑊򊹴󧙵å񺢏𒪤󜟵󒌗򭦶𰌽󺝥󫶪񞣻􇌙񃄥󃒃변򶲛񙾿񽆆򍙂󂺧񞀰󯲺󖌻𸙩𓾬",
        nonce: RenVMValue<RenVMType.B32>; // "GWsi_pwKD1KHsz9H1wXdn2aHtWuJOG2S-XgnShYPr3E",
    }
>;

export type BurnTransactionInput = TransactionInput<BurnParams>;

export const mintParamsType: PackStruct = {
    struct: [
        {
            output: {
                struct: [
                    {
                        outpoint: {
                            struct: [
                                {
                                    hash: PackPrimitive.Bytes32,
                                },
                                {
                                    index: PackPrimitive.U32,
                                },
                            ],
                        },
                    },
                    {
                        value: PackPrimitive.U64,
                    },
                    {
                        pubKeyScript: PackPrimitive.Bytes,
                    },
                ],
            },
        },
        {
            payload: PackPrimitive.Bytes,
        },
        {
            phash: PackPrimitive.Bytes32,
        },
        {
            token: PackPrimitive.String,
        },
        {
            to: PackPrimitive.String,
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

export type MintParams = RPCValue<
    // Types
    typeof mintParamsType,
    // Values
    {
        ghash: RenVMValue<RenVMType.B32>; // "x0gTBzbXmM1Xdwk-B8PHJ4sgY2T_NcrWsxK6MJ2xYos",
        gpubkey: RenVMValue<RenVMType.B>; // "8Qnq",
        nhash: RenVMValue<RenVMType.B32>; // "a_46LkThVhVYlkIxBXaInubuEmYcfDNk45EBl60prhA",
        nonce: RenVMValue<RenVMType.B32>; // "vPIiF6apzdJ4Rr8IMpT2uywo8LbuHOcaEXQ21ydXFBA",
        output: {
            outpoint: {
                hash: RenVMValue<RenVMType.B32>; // "_yJG1tKIALMrvaSes9BB4dYx5eCN8OK5V_PEM4N3R10",
                index: RenVMValue<RenVMType.U32>; // "2288363171"
            };
            pubKeyScript: RenVMValue<RenVMType.B>; // "8SsHPc0wCbrItrmmFOsebOtGwd8YOSDTFyaGT7UZHRVGCtEjv0_N17kNJ5RqF8nxzbddbqELUOjxZe3n_llGksd7sEMbQg",
            value: RenVMValue<RenVMType.U64>; // "503863382662879832"
        };
        payload: RenVMValue<RenVMType.B>; // "I_9MVtYiO4NlH7lwIx8",
        phash: RenVMValue<RenVMType.B32>; // "ibSvPHswcsI3o3nkQRpHp23ANg3tf9L5ivk5kKwnGTQ",
        to: RenVMValue<RenVMType.Str>; // "򝊞􋄛𧚞󥫨򨚘󳽈򤙳񙓻򳳱􎖫򗣌𻄭񑦁򏬰񆆅򒒛􊗓𧜿򇞣􁓹",
        token: RenVMValue<RenVMType.Str>; // ""
    }
>;

export type MintTransactionInput = TransactionInput<MintParams>;
