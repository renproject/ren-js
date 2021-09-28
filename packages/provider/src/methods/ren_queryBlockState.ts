import {
    Marshalled,
    PackPrimitive,
    PackTypeDefinition,
    TypedPackValue,
    Unmarshalled,
} from "../pack/pack";

// ParamsQueryBlockState defines the parameters of the MethodQueryBlockState.
export interface ParamsQueryBlockState {
    // No parameters.
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
        latestHeight: Unmarshalled<PackPrimitive.U256>;
        gasCap: Unmarshalled<PackPrimitive.U256>;
        gasLimit: Unmarshalled<PackPrimitive.U256>;
        gasPrice: Unmarshalled<PackPrimitive.U256>;
        minimumAmount: Unmarshalled<PackPrimitive.U256>;
        dustAmount: Unmarshalled<PackPrimitive.U256>;
        fees: {
            chains: Array<{
                burnFee: Unmarshalled<PackPrimitive.U64>;
                chain: Unmarshalled<PackPrimitive.Str>;
                mintFee: Unmarshalled<PackPrimitive.U64>;
            }>;
            epochs: Array<{
                amount: Unmarshalled<PackPrimitive.U256>;
                epoch: Unmarshalled<PackPrimitive.U64>;
                numNodes: Unmarshalled<PackPrimitive.U64>;
            }>;
            nodes: Array<{
                node: Unmarshalled<PackPrimitive.Bytes32>;
                lastEpochClaimed: Unmarshalled<PackPrimitive.U64>;
            }>;
            unassigned: Unmarshalled<PackPrimitive.U256>;
        };
        shards: Array<{
            shard: Unmarshalled<PackPrimitive.Bytes32>;
            pubKey: Unmarshalled<PackPrimitive.Bytes>;
            queue: Array<{
                hash: Unmarshalled<PackPrimitive.Bytes32>;
            }>;
            state: {
                outpoint: {
                    hash: Unmarshalled<PackPrimitive.Bytes>;
                    index: Unmarshalled<PackPrimitive.U32>;
                };
                value: Unmarshalled<PackPrimitive.U256>;
                pubKeyScript: Unmarshalled<PackPrimitive.Bytes>;
            };
        }>;
        minted: Array<{
            chain: Unmarshalled<PackPrimitive.Str>;
            amount: Unmarshalled<PackPrimitive.U256>;
        }>;
    };
}
