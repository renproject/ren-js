import { AbiInput } from "./abi";

export type EthInt =
    | "int"
    | "int8"
    | "int16"
    | "int24"
    | "int32"
    | "int40"
    | "int48"
    | "int56"
    | "int64"
    | "int72"
    | "int80"
    | "int88"
    | "int96"
    | "int104"
    | "int112"
    | "int120"
    | "int128"
    | "int136"
    | "int144"
    | "int152"
    | "int160"
    | "int168"
    | "int176"
    | "int184"
    | "int192"
    | "int200"
    | "int208"
    | "int216"
    | "int224"
    | "int232"
    | "int240"
    | "int248"
    | "int256";
export type EthUint =
    | "uint"
    | "uint8"
    | "uint16"
    | "uint24"
    | "uint32"
    | "uint40"
    | "uint48"
    | "uint56"
    | "uint64"
    | "uint72"
    | "uint80"
    | "uint88"
    | "uint96"
    | "uint104"
    | "uint112"
    | "uint120"
    | "uint128"
    | "uint136"
    | "uint144"
    | "uint152"
    | "uint160"
    | "uint168"
    | "uint176"
    | "uint184"
    | "uint192"
    | "uint200"
    | "uint208"
    | "uint216"
    | "uint224"
    | "uint232"
    | "uint240"
    | "uint248"
    | "uint256";
export type EthByte =
    | "bytes"
    | "bytes1"
    | "bytes2"
    | "bytes3"
    | "bytes4"
    | "bytes5"
    | "bytes6"
    | "bytes7"
    | "bytes8"
    | "bytes9"
    | "bytes10"
    | "bytes11"
    | "bytes12"
    | "bytes13"
    | "bytes14"
    | "bytes15"
    | "bytes16"
    | "bytes17"
    | "bytes18"
    | "bytes19"
    | "bytes20"
    | "bytes21"
    | "bytes22"
    | "bytes23"
    | "bytes24"
    | "bytes25"
    | "bytes26"
    | "bytes27"
    | "bytes28"
    | "bytes29"
    | "bytes30"
    | "bytes31"
    | "bytes32";
export type EthType =
    | "address"
    | "bool"
    | "string"
    | "var"
    | EthInt
    | EthUint
    | "byte"
    | EthByte
    // Added to support tuples.
    | string;

export interface EthArg<
    name extends string = string,
    type extends EthType = EthType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valueType = any,
> {
    name: name;
    type: type;
    value: valueType;
    components?: AbiInput[];

    /**
     * `notInPayload` indicates that the parameter should be used when calling
     * the smart contract but it should not be used when calculating the
     * payload hash. This is useful for values can only be known at the time
     * of calling the contract. Note that others may be able to submit the mint
     * and set their own value, unless the contract caller is restricted somehow.
     */
    notInPayload?: boolean;

    /**
     * `onlyInPayload` indicates that the parameter should be used when
     * calculating the payload hash but it should not be passed in to the
     * contract call. This is useful for values that don't need to be explicitly
     * passed in to the contract, such as the contract caller.
     *
     * `notInPayload` and `onlyInPayload` can be used together to allow users to
     * update values such as exchange rate slippage, which may have updated
     * while waiting for the lock-chain confirmations - while ensuring that
     * others can't change it for them.
     */
    onlyInPayload?: boolean;
}

export type EthArgs = EthArg[];
