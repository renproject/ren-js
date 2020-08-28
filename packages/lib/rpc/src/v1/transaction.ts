import { RenVMArg, RenVMInputUTXO, RenVMOutputUTXO, RenVMType } from "./value";

export type MintArgsArray = [
    RenVMArg<"p", RenVMType.ExtEthCompatPayload>,
    RenVMArg<"token", RenVMType.ExtTypeEthCompatAddress>, // base64
    RenVMArg<"to", RenVMType.ExtTypeEthCompatAddress>, // base64
    RenVMArg<"n", RenVMType.B32>, // base64
    RenVMArg<"utxo", RenVMType.ExtTypeBtcCompatUTXO, RenVMInputUTXO>
];

export type BurnArgsArray = [RenVMArg<"ref", RenVMType.U64>];

export type TxBurnReturnedInputs = [
    RenVMArg<"ref", RenVMType.U64>,
    RenVMArg<"to", RenVMType.B>, // base64
    RenVMArg<"amount", RenVMType.U256> | RenVMArg<"amount", RenVMType.U64>
];

export type TxResponseOutputs = [
    RenVMArg<"r", RenVMType.B32> | RenVMArg<"r", RenVMType.B>, // base64
    RenVMArg<"s", RenVMType.B32> | RenVMArg<"s", RenVMType.B>, // base64
    RenVMArg<"v", RenVMType.U8> | RenVMArg<"v", RenVMType.B> // base64
];

export type TxAutogen = [
    RenVMArg<"phash", RenVMType.B32>, // base64
    RenVMArg<"ghash", RenVMType.B32>, // base 64
    RenVMArg<"nhash", RenVMType.B32>, // base 64
    RenVMArg<"amount", RenVMType.U256>,
    RenVMArg<"utxo", RenVMType.ExtTypeBtcCompatUTXO, RenVMOutputUTXO>,
    RenVMArg<"sighash", RenVMType.B32> // base 64
];
