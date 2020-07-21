
export enum RenNetwork {
    Mainnet = "mainnet",
    Chaosnet = "chaosnet",
    Testnet = "testnet",
    Devnet = "devnet",
    Localnet = "localnet",
}
export const RenNetworks = [RenNetwork.Mainnet, RenNetwork.Chaosnet, RenNetwork.Testnet, RenNetwork.Devnet, RenNetwork.Localnet];
export const isRenNetwork = (maybeRenNetwork: any): maybeRenNetwork is RenNetwork => // tslint:disable-line: no-any
    RenNetworks.indexOf(maybeRenNetwork) !== -1;

export type Chain = string;

export type Asset = string;

export type RenContract = string;

export enum RenVMType {
    TypeAddress = "address",
    TypeStr = "str",
    TypeB32 = "b32",
    TypeB = "b",
    TypeI8 = "i8",
    TypeI16 = "i16",
    TypeI32 = "i32",
    TypeI64 = "i64",
    TypeI128 = "i128",
    TypeI256 = "i256",
    TypeU8 = "u8",
    TypeU16 = "u16",
    TypeU32 = "u32",
    TypeU64 = "u64",
    TypeU128 = "u128",
    TypeU256 = "u256",
    TypeRecord = "record",
    TypeList = "list",

    // Ext
    ExtTypeEthCompatAddress = "ext_ethCompatAddress",
    ExtTypeBtcCompatUTXO = "ext_btcCompatUTXO",
    ExtTypeBtcCompatUTXOs = "ext_btcCompatUTXOs",
    ExtTypeEthCompatTx = "ext_ethCompatTx",
    ExtEthCompatPayload = "ext_ethCompatPayload",
}

export interface RenVMOutputUTXO {
    txHash: RenVMValue<RenVMType.TypeB32>;
    vOut: RenVMValue<RenVMType.TypeU32>;
    scriptPubKey: RenVMValue<RenVMType.TypeB>;
    amount: RenVMValue<RenVMType.TypeU64>;
}

export interface RenVMInputUTXO {
    txHash: RenVMValue<RenVMType.TypeB32>;
    vOut: RenVMValue<RenVMType.TypeU32>;
    scriptPubKey?: RenVMValue<RenVMType.TypeB>;
    amount?: RenVMValue<RenVMType.TypeU64>;
}

export type RenVMUTXO = RenVMOutputUTXO | RenVMInputUTXO;

export type Base64String = string;
export type HexString = string;
export type DecimalString = string;

export interface ExtEthCompatPayload {
    abi: RenVMValue<RenVMType.TypeB>;
    value: RenVMValue<RenVMType.TypeB>;
    fn: RenVMValue<RenVMType.TypeB>;
}

export type RenVMValue<Type extends RenVMType> =
    Type extends RenVMType.TypeAddress ? string :
    Type extends RenVMType.TypeStr ? Base64String :
    Type extends RenVMType.TypeB32 ? Base64String :
    Type extends RenVMType.TypeB ? Base64String :
    Type extends RenVMType.TypeI8 ? DecimalString :
    Type extends RenVMType.TypeI16 ? DecimalString :
    Type extends RenVMType.TypeI32 ? DecimalString :
    Type extends RenVMType.TypeI64 ? DecimalString :
    Type extends RenVMType.TypeI128 ? DecimalString :
    Type extends RenVMType.TypeI256 ? DecimalString :
    Type extends RenVMType.TypeU8 ? DecimalString :
    Type extends RenVMType.TypeU16 ? DecimalString :
    Type extends RenVMType.TypeU32 ? DecimalString :
    Type extends RenVMType.TypeU64 ? DecimalString :
    Type extends RenVMType.TypeU128 ? DecimalString :
    Type extends RenVMType.TypeU256 ? DecimalString :
    // tslint:disable-next-line: no-any
    Type extends RenVMType.TypeRecord ? any :
    // tslint:disable-next-line: no-any
    Type extends RenVMType.TypeList ? any[] :
    Type extends RenVMType.ExtTypeEthCompatAddress ? HexString :
    Type extends RenVMType.ExtTypeBtcCompatUTXO ? RenVMUTXO :
    Type extends RenVMType.ExtTypeBtcCompatUTXOs ? RenVMUTXO[] :
    // tslint:disable-next-line: no-any
    Type extends RenVMType.ExtTypeEthCompatTx ? any :
    Type extends RenVMType.ExtEthCompatPayload ? ExtEthCompatPayload :
    // tslint:disable-next-line: no-any
    any;

export interface RenVMArg<Name extends string, Type extends RenVMType, Value extends RenVMValue<Type> = RenVMValue<Type>> {
    name: Name;
    type: Type;
    value: Value;
}

// tslint:disable-next-line: no-any
export type RenVMArgs = Array<RenVMArg<string, RenVMType>>;


export interface MintAndBurnFees {
    mint: RenVMValue<RenVMType.TypeU64>;
    burn: RenVMValue<RenVMType.TypeU64>;
}

export interface Fees {
    lock: RenVMValue<RenVMType.TypeU64>;
    release: RenVMValue<RenVMType.TypeU64>;
    ethereum: MintAndBurnFees;
}
