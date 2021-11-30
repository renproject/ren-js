import BigNumber from "bignumber.js";

import {
    Marshalled,
    PackPrimitive,
    PackTypeDefinition,
    TypedPackValue,
} from "@renproject/utils";

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
                node: Buffer;
                lastEpochClaimed: BigNumber;
            }>;
            unassigned: BigNumber;
        };
        shards: Array<{
            shard: Buffer;
            pubKey: Buffer;
            queue: Array<{
                hash: Buffer;
            }>;
            state: {
                outpoint: {
                    hash: Buffer;
                    index: BigNumber;
                };
                value: BigNumber;
                pubKeyScript: Buffer;
            };
        }>;
        minted: Array<{
            chain: string;
            amount: BigNumber;
        }>;
    };
}
