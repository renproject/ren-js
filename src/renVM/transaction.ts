import { RenVMArg, RenVMInputUTXO, RenVMOutputUTXO, RenVMType } from "@renproject/ren-js-common";

// Minting/Shifting ////////////////////////////////////////////////////////////

export type MintArgsArray = [
    RenVMArg<"p", RenVMType.ExtEthCompatPayload>,
    RenVMArg<"token", RenVMType.ExtTypeEthCompatAddress>, // base64
    RenVMArg<"to", RenVMType.ExtTypeEthCompatAddress>, // base64
    RenVMArg<"n", RenVMType.TypeB32>, // base64
    RenVMArg<"utxo", RenVMType.ExtTypeBtcCompatUTXO, RenVMInputUTXO>,
];

export type BurnArgsArray = [
    RenVMArg<"ref", RenVMType.TypeU64>,
];

export type TxBurnReturnedInputs = [
    RenVMArg<"ref", RenVMType.TypeU64>,
    RenVMArg<"to", RenVMType.TypeB>, // base64
    RenVMArg<"amount", RenVMType.TypeU256> | RenVMArg<"amount", RenVMType.TypeU64>,
];

export type TxResponseOutputs = [
    RenVMArg<"r", RenVMType.TypeB32> | RenVMArg<"r", RenVMType.TypeB>, // base64
    RenVMArg<"s", RenVMType.TypeB32> | RenVMArg<"s", RenVMType.TypeB>, // base64
    RenVMArg<"v", RenVMType.TypeU8> | RenVMArg<"v", RenVMType.TypeB>, // base64
];

export type TxAutogen = [
    RenVMArg<"ghash", RenVMType.TypeB32>, // base 64
    RenVMArg<"nhash", RenVMType.TypeB32>, // base 64
    RenVMArg<"sighash", RenVMType.TypeB32>, // base 64
    RenVMArg<"phash", RenVMType.TypeB32>, // base64
    RenVMArg<"amount", RenVMType.TypeU256>,
    RenVMArg<"utxo", RenVMType.ExtTypeBtcCompatUTXO, RenVMOutputUTXO>,
];
