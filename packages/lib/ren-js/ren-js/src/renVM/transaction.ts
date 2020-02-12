import {
    RenContract, RenVMArg, RenVMInputUTXO, RenVMOutputUTXO, RenVMType, TxStatus,
} from "@renproject/ren-js-common";

// Minting/Shifting ////////////////////////////////////////////////////////////

export type MintArgsArray = [
    RenVMArg<"phash", RenVMType.TypeB32>, // base64
    // Arg<"amount", RenVMType.TypeU64, number>,
    RenVMArg<"token", RenVMType.ExtTypeEthCompatAddress>, // base64
    RenVMArg<"to", RenVMType.ExtTypeEthCompatAddress>, // base64
    RenVMArg<"n", RenVMType.TypeB32>, // base64
    RenVMArg<"utxo", RenVMType.ExtTypeBtcCompatUTXO, RenVMInputUTXO>
];

export type BurnArgsArray = [
    RenVMArg<"ref", RenVMType.TypeU64>,
];

export type TxMintReturnedInputs = [
    RenVMArg<"phash", RenVMType.TypeB32>, // base64
    // RenVMArg<"amount", RenVMType.TypeU64>,
    RenVMArg<"token", RenVMType.ExtTypeEthCompatAddress>, // base64
    RenVMArg<"to", RenVMType.ExtTypeEthCompatAddress>, // base64
    RenVMArg<"n", RenVMType.TypeB32>, // base64
    RenVMArg<"utxo", RenVMType.ExtTypeBtcCompatUTXO, RenVMOutputUTXO>,
    RenVMArg<"amount", RenVMType.TypeU256>,
];

export type TxBurnReturnedInputs = [
    RenVMArg<"ref", RenVMType.TypeU64>,
    RenVMArg<"to", RenVMType.TypeB>, // base64
    RenVMArg<"amount", RenVMType.TypeU256> | RenVMArg<"amount", RenVMType.TypeU64>,
];

export type TxResponseOutputs = [
    RenVMArg<"r", RenVMType.TypeB>, // base64
    RenVMArg<"s", RenVMType.TypeB>, // base64
    RenVMArg<"v", RenVMType.TypeB>, // base64
];

export type TxAutogen = [
    RenVMArg<"ghash", RenVMType.TypeB32>, // base 64
    RenVMArg<"nhash", RenVMType.TypeB32>, // base 64
    RenVMArg<"sighash", RenVMType.TypeB32>, // base 64
];

export interface UnmarshalledMintTx {
    hash: string; // Buffer;
    txStatus: TxStatus;
    to: RenContract;
    in: {
        phash: string; // Buffer;
        token: string;
        to: string;
        n: string; // Buffer;
        utxo: { "txHash": string, "vOut": number, "scriptPubKey": string, "amount": string };
        amount: string;
    };
    autogen: {
        ghash: string; // Buffer;
        nhash: string; // Buffer;
        sighash: string; // Buffer;
    };
    out?: {
        r: string;
        s: string;
        v: string;
    };
}

export interface UnmarshalledBurnTx {
    hash: string; // Buffer;
    to: RenContract;
    in: {
        ref: string;
        to: string; // Buffer;
        amount: string;
    };
}
