import {
    Marshalled,
    PackPrimitive,
    PackTypeDefinition,
    TypedPackValue,
} from "@renproject/utils";
import BigNumber from "bignumber.js";

// ParamsQueryBlockState defines the parameters of the MethodQueryBlockState.
export interface ParamsQueryBlockState {
    contract: string;
}

export interface ResponseQueryBlockState {
    state: TypedPackValue<
        PackTypeDefinition,
        {
            [asset: string]: {
                latestHeight: Marshalled<PackPrimitive.U256>;
                gasCap: Marshalled<PackPrimitive.U256>;
                gasLimit: Marshalled<PackPrimitive.U256>;
                gasPrice: Marshalled<PackPrimitive.U256>;
                minimumAmount: Marshalled<PackPrimitive.U256>;
                dustAmount: Marshalled<PackPrimitive.U256>;
                fees: {
                    chains: Array<{
                        burnAndMintFee: Marshalled<PackPrimitive.U64>;
                        burnFee: Marshalled<PackPrimitive.U64>;
                        chain: Marshalled<PackPrimitive.Str>;
                        mintFee: Marshalled<PackPrimitive.U64>;
                    }>;
                    epochs: Array<{
                        amount: Marshalled<PackPrimitive.U256>;
                        epoch: Marshalled<PackPrimitive.U64>;
                        numNodes: Marshalled<PackPrimitive.U64>;
                    }>;
                    nodes: Array<{
                        node: Marshalled<PackPrimitive.Bytes32>;
                        lastEpochClaimed: Marshalled<PackPrimitive.U64>;
                    }>;
                    unassigned: Marshalled<PackPrimitive.U256>;
                    unclaimed: Marshalled<PackPrimitive.U256>;
                    reserved: {
                        fund: Marshalled<PackPrimitive.U256>;
                    };
                };
                shards: Array<{
                    shard: Marshalled<PackPrimitive.Bytes32>;
                    pubKey: Marshalled<PackPrimitive.Bytes>;
                    queue: Array<{
                        hash: Marshalled<PackPrimitive.Bytes32>;
                    }>;
                    state: {
                        outpoint: {
                            hash: Marshalled<PackPrimitive.Bytes>;
                            index: Marshalled<PackPrimitive.U32>;
                        };
                        value: Marshalled<PackPrimitive.U256>;
                        pubKeyScript: Marshalled<PackPrimitive.Bytes>;
                    };
                }>;
                minted: Array<{
                    chain: Marshalled<PackPrimitive.Str>;
                    amount: Marshalled<PackPrimitive.U256>;
                }>;
            };
        }
    >;
}

export interface BlockState {
    [asset: string]: {
        latestHeight: BigNumber;
        gasCap: BigNumber;
        gasLimit: BigNumber;
        gasPrice: BigNumber;
        minimumAmount: BigNumber;
        dustAmount: BigNumber;
        fees: {
            chains: Array<{
                burnAndMintFee: BigNumber;
                burnFee: BigNumber;
                chain: string;
                mintFee: BigNumber;
            }>;
            epochs: Array<{
                amount: BigNumber;
                epoch: BigNumber;
                numNodes: BigNumber;
            }>;
            nodes: Array<{
                node: Uint8Array;
                lastEpochClaimed: BigNumber;
            }>;
            unassigned: BigNumber;
            unclaimed: BigNumber;
            reserved: {
                fund: BigNumber;
            };
        };
        shards: Array<{
            shard: Uint8Array;
            pubKey: Uint8Array;
            queue: Array<{
                hash: Uint8Array;
            }>;
            state: {
                outpoint: {
                    hash: Uint8Array;
                    index: BigNumber;
                };
                value: BigNumber;
                pubKeyScript: Uint8Array;
            };
        }>;
        minted: Array<{
            chain: string;
            amount: BigNumber;
        }>;
    };
}
