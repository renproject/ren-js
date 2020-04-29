import { chaosnet, devnet, localnet, mainnet, testnet } from "@renproject/contracts";

export interface NetworkDetails {
    name: string;
    nodeURLs: string[];
    isTestnet: boolean;
    ethNetwork: string;

    mercuryURL: {
        btc: string,
        zec: string,
        bch: string,
    };
    chainSoName: {
        btc: string,
        zec: string,
        bch: string,
    };
    contracts: typeof mainnet | typeof chaosnet | typeof testnet | typeof devnet | typeof localnet;
}


export enum RenNetwork {
    Mainnet = "mainnet",
    Chaosnet = "chaosnet",
    Testnet = "testnet",
    Devnet = "devnet",
    Localnet = "localnet",
}

export enum Chain {
    Bitcoin = "Btc",
    Ethereum = "Eth",
    Zcash = "Zec",
    BitcoinCash = "Bch",
}

export enum Asset {
    BTC = "BTC",
    ZEC = "ZEC",
    ETH = "ETH",
    BCH = "BCH",
}

export enum RenContract {
    Btc2Eth = "BTC0Btc2Eth",
    Eth2Btc = "BTC0Eth2Btc",
    Zec2Eth = "ZEC0Zec2Eth",
    Eth2Zec = "ZEC0Eth2Zec",
    Bch2Eth = "BCH0Bch2Eth",
    Eth2Bch = "BCH0Eth2Bch",
}

export const Tokens = {
    // Bitcoin
    BTC: {
        Mint: RenContract.Btc2Eth,
        Btc2Eth: RenContract.Btc2Eth,

        Burn: RenContract.Eth2Btc,
        Eth2Btc: RenContract.Eth2Btc,
    },

    // Zcash
    ZEC: {
        Mint: RenContract.Zec2Eth,
        Zec2Eth: RenContract.Zec2Eth,

        Burn: RenContract.Eth2Zec,
        Eth2Zec: RenContract.Eth2Zec,
    },

    // Bitcoin Cash
    BCH: {
        Mint: RenContract.Bch2Eth,
        Bch2Eth: RenContract.Bch2Eth,

        Burn: RenContract.Eth2Bch,
        Eth2Bch: RenContract.Eth2Bch,
    },
};

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
