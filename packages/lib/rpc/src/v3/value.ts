export enum RenVMType {
    Address = "address",
    Str = "str",
    B32 = "b32",
    B = "b",
    I8 = "i8",
    I16 = "i16",
    I32 = "i32",
    I64 = "i64",
    I128 = "i128",
    I256 = "i256",
    U8 = "u8",
    U16 = "u16",
    U32 = "u32",
    U64 = "u64",
    U128 = "u128",
    U256 = "u256",
    Record = "record",
    List = "list",

    // Ext
    ExtTypeEthCompatAddress = "ext_ethCompatAddress",
    ExtTypeBtcCompatUTXO = "ext_btcCompatUTXO",
    ExtTypeBtcCompatUTXOs = "ext_btcCompatUTXOs",
    ExtTypeEthCompatTx = "ext_ethCompatTx",
    ExtEthCompatPayload = "ext_ethCompatPayload",
}

export interface RenVMOutputUTXO {
    txHash: RenVMValue<RenVMType.B32>;
    vOut: RenVMValue<RenVMType.U32>;
    scriptPubKey: RenVMValue<RenVMType.B>;
    amount: RenVMValue<RenVMType.U64>;
}

export interface RenVMInputUTXO {
    txHash: RenVMValue<RenVMType.B32>;
    vOut: RenVMValue<RenVMType.U32>;
    scriptPubKey?: RenVMValue<RenVMType.B>;
    amount?: RenVMValue<RenVMType.U64>;
}

export type RenVMUTXO = RenVMOutputUTXO | RenVMInputUTXO;

export type Base64String = string;
export type HexString = string;
export type DecimalString = string;

export interface ExtEthCompatPayload {
    abi: RenVMValue<RenVMType.B>;
    value: RenVMValue<RenVMType.B>;
    fn: RenVMValue<RenVMType.B>;
}

export type RenVMValue<Type extends RenVMType> = Type extends RenVMType.Address
    ? string
    : Type extends RenVMType.Str
    ? Base64String
    : Type extends RenVMType.B32
    ? Base64String
    : Type extends RenVMType.B
    ? Base64String
    : Type extends RenVMType.I8
    ? DecimalString
    : Type extends RenVMType.I16
    ? DecimalString
    : Type extends RenVMType.I32
    ? DecimalString
    : Type extends RenVMType.I64
    ? DecimalString
    : Type extends RenVMType.I128
    ? DecimalString
    : Type extends RenVMType.I256
    ? DecimalString
    : Type extends RenVMType.U8
    ? DecimalString
    : Type extends RenVMType.U16
    ? DecimalString
    : Type extends RenVMType.U32
    ? DecimalString
    : Type extends RenVMType.U64
    ? DecimalString
    : Type extends RenVMType.U128
    ? DecimalString
    : Type extends RenVMType.U256
    ? DecimalString
    : Type extends RenVMType.Record
    ? any // eslint-disable-line @typescript-eslint/no-explicit-any
    : Type extends RenVMType.List
    ? any[] // eslint-disable-line @typescript-eslint/no-explicit-any
    : Type extends RenVMType.ExtTypeEthCompatAddress
    ? HexString
    : Type extends RenVMType.ExtTypeBtcCompatUTXO
    ? RenVMUTXO
    : Type extends RenVMType.ExtTypeBtcCompatUTXOs
    ? RenVMUTXO[]
    : Type extends RenVMType.ExtTypeEthCompatTx
    ? any // eslint-disable-line @typescript-eslint/no-explicit-any
    : Type extends RenVMType.ExtEthCompatPayload
    ? ExtEthCompatPayload
    : any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface MintAndBurnFees {
    mint: RenVMValue<RenVMType.U64>;
    burn: RenVMValue<RenVMType.U64>;
}

interface MintFees {
    [chain: string]: MintAndBurnFees;
}

interface LockFees {
    lock: RenVMValue<RenVMType.U64>;
    release: RenVMValue<RenVMType.U64>;
}

export type Fees = LockFees & MintFees;
