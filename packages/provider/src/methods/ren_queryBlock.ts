import { Marshalled, PackPrimitive, PackStructType } from "@renproject/utils";

export const renVMBlockType: PackStructType = {
    struct: [
        { height: PackPrimitive.U64 },
        { hash: PackPrimitive.Bytes },
        { parentHash: PackPrimitive.Bytes },
        { commitment: { list: PackPrimitive.Bytes } },
        { timestamp: PackPrimitive.U64 },
        { round: PackPrimitive.U64 },
        { stateRoot: PackPrimitive.Bytes },
        { intrinsicTxs: { list: PackPrimitive.Bytes } },
        { extrinsicTxs: { list: PackPrimitive.Bytes } },
    ],
};

export interface MarshalledRenVMBlock {
    height: Marshalled<PackPrimitive.U64>;
    hash: Marshalled<PackPrimitive.Bytes>;
    parentHash: Marshalled<PackPrimitive.Bytes>;
    commitment: Array<Marshalled<PackPrimitive.Bytes>>;
    timestamp: Marshalled<PackPrimitive.U64>;
    round: Marshalled<PackPrimitive.U64>;
    stateRoot: Marshalled<PackPrimitive.Bytes>;
    intrinsicTxs: Array<Marshalled<PackPrimitive.Bytes>>;
    extrinsicTxs: Array<Marshalled<PackPrimitive.Bytes>>;
}

// ParamsQueryBlock defines the parameters of the MethodQueryBlock.
export interface ParamsQueryBlock {
    // BlockHeight of the block that will be returned. A nil value can be used
    // to request the latest block.
    blockHeight?: Marshalled<PackPrimitive.U64>;
}

// ParamsQueryBlocks defines the parameters of the MethodQueryBlocks.
export interface ParamsQueryBlocks {
    // BlockHeight of the youngest block that will be returned in the list. A
    // nil value can be used to request a list of the latest blocks.
    blockHeight?: Marshalled<PackPrimitive.U64>;
    // N defines the maximum number of ancestor blocks that will be returned. A
    // nil value can be used to request the maximum allowed number of blocks.
    n?: Marshalled<PackPrimitive.U64>;
}

// ResponseQueryBlock defines the response of the MethodQueryBlock.
export interface ResponseQueryBlock {
    block: MarshalledRenVMBlock; // Block json.RawMessage`json:"block"`
}

// ResponseQueryBlocks defines the response of the MethodQueryBlocks.
export interface ResponseQueryBlocks {
    blocks: MarshalledRenVMBlock[]; // Blocks json.RawMessage`json:"blocks"`
}
