import { BN } from "../general";

export enum ShiftedToken {
    zBTC = "zBTC",
    zZEC = "zZEC",
    zBCH = "zBCH",
}

export type EthInt = "int" | "int8" | "int16" | "int24" | "int32" | "int40" | "int48" | "int56" | "int64" | "int72" | "int80" | "int88" | "int96" | "int104" | "int112" | "int120" | "int128" | "int136" | "int144" | "int152" | "int160" | "int168" | "int176" | "int184" | "int192" | "int200" | "int208" | "int216" | "int224" | "int232" | "int240" | "int248" | "int256";
export type EthUint = "uint" | "uint8" | "uint16" | "uint24" | "uint32" | "uint40" | "uint48" | "uint56" | "uint64" | "uint72" | "uint80" | "uint88" | "uint96" | "uint104" | "uint112" | "uint120" | "uint128" | "uint136" | "uint144" | "uint152" | "uint160" | "uint168" | "uint176" | "uint184" | "uint192" | "uint200" | "uint208" | "uint216" | "uint224" | "uint232" | "uint240" | "uint248" | "uint256";
export type EthByte = "bytes" | "bytes1" | "bytes2" | "bytes3" | "bytes4" | "bytes5" | "bytes6" | "bytes7" | "bytes8" | "bytes9" | "bytes10" | "bytes11" | "bytes12" | "bytes13" | "bytes14" | "bytes15" | "bytes16" | "bytes17" | "bytes18" | "bytes19" | "bytes20" | "bytes21" | "bytes22" | "bytes23" | "bytes24" | "bytes25" | "bytes26" | "bytes27" | "bytes28" | "bytes29" | "bytes30" | "bytes31" | "bytes32";
export type EthType = "address" | "bool" | "string" | "var" | EthInt | EthUint | "byte" | EthByte;

export interface TransactionConfig {
    from?: string | number;
    to?: string;
    value?: number | string | BN;
    gas?: number | string;
    gasPrice?: number | string | BN;
    data?: string;
    nonce?: number;
    chainId?: number;
}

export interface EthArg<name extends string, type extends EthType, valueType> {
    name: name;
    type: type;
    value: valueType; // "8d8126"
}

// tslint:disable-next-line: no-any
export type EthArgs = Array<EthArg<string, EthType, any>>;


export interface BaseContractCall {
    sendTo: string; // The address of the adapter smart contract
    txConfig?: TransactionConfig; // Set transaction options:
}

export interface DetailedContractCall {
    sendTo: string; // The address of the adapter smart contract
    contractFn: string; // The name of the function to be called on the Adapter contract
    contractParams?: EthArgs; // The parameters to be passed to the adapter contract
    txConfig?: TransactionConfig; // Set transaction options:
}

// export type Undefined<T> = { [key in keyof T]: undefined };
export type UndefinedExceptFirst2<A, B> = { [key in (keyof A | keyof B)]: key extends (keyof A) ? A[key] : undefined };
export type UndefinedExceptFirst3<A, B, C> = { [key in (keyof A | keyof B | keyof C)]: key extends (keyof A) ? A[key] : undefined };
export type UndefinedExceptFirst4<A, B, C, D> = { [key in (keyof A | keyof B | keyof C | keyof D)]: key extends (keyof A) ? A[key] : undefined };

export type AllParams2<A, B> = UndefinedExceptFirst2<A, B> | UndefinedExceptFirst2<B, A>;
export type AllParams3<A, B, C> = UndefinedExceptFirst3<A, B, C> | UndefinedExceptFirst3<B, A, C> | UndefinedExceptFirst3<C, A, B>;
export type AllParams4<A, B, C, D> = UndefinedExceptFirst4<A, B, C, D> | UndefinedExceptFirst4<B, A, C, D> | UndefinedExceptFirst4<C, A, B, D> | UndefinedExceptFirst4<D, A, B, C>;

export type ContractCallMultiple<T> = { contractCalls: T[] };
