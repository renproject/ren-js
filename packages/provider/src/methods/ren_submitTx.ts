import {
    Marshalled,
    PackPrimitive,
    PackTypeDefinition,
    TxStatus,
    TypedPackValue,
} from "@renproject/utils";

export const burnParamsType: PackTypeDefinition = {
    struct: [
        {
            amount: PackPrimitive.U256,
        },
        {
            to: PackPrimitive.Str,
        },
        {
            nonce: PackPrimitive.Bytes32,
        },
    ],
};

export const crossChainParamsType: PackTypeDefinition = {
    struct: [
        {
            txid: PackPrimitive.Bytes,
        },
        {
            txindex: PackPrimitive.U32,
        },
        {
            amount: PackPrimitive.U256,
        },
        {
            payload: PackPrimitive.Bytes,
        },
        {
            phash: PackPrimitive.Bytes32,
        },
        {
            to: PackPrimitive.Str,
        },
        {
            nonce: PackPrimitive.Bytes32,
        },
        {
            nhash: PackPrimitive.Bytes32,
        },
        {
            gpubkey: PackPrimitive.Bytes,
        },
        {
            ghash: PackPrimitive.Bytes32,
        },
    ],
};

export type EmptyRPCStruct = TypedPackValue<{ struct: [] }, {}>;

export type CrossChainParams = TypedPackValue<
    // Types
    typeof crossChainParamsType,
    // Values
    {
        amount: Marshalled<PackPrimitive.U256>;
        ghash: Marshalled<PackPrimitive.Bytes32>; // "x0gTBzbXmM1Xdwk-B8PHJ4sgY2T_NcrWsxK6MJ2xYos",
        gpubkey: Marshalled<PackPrimitive.Bytes>; // "8Qnq",
        nhash: Marshalled<PackPrimitive.Bytes32>; // "a_46LkThVhVYlkIxBXaInubuEmYcfDNk45EBl60prhA",
        nonce: Marshalled<PackPrimitive.Bytes32>; // "vPIiF6apzdJ4Rr8IMpT2uywo8LbuHOcaEXQ21ydXFBA",
        payload: Marshalled<PackPrimitive.Bytes>; // "I_9MVtYiO4NlH7lwIx8",
        phash: Marshalled<PackPrimitive.Bytes32>; // "ibSvPHswcsI3o3nkQRpHp23ANg3tf9L5ivk5kKwnGTQ",
        to: Marshalled<PackPrimitive.Str>; // "򝊞􋄛𧚞󥫨򨚘󳽈򤙳񙓻򳳱􎖫򗣌𻄭񑦁򏬰񆆅򒒛􊗓𧜿򇞣􁓹",
        txid: Marshalled<PackPrimitive.Bytes>;
        txindex: Marshalled<PackPrimitive.U32>;
    }
>;

export interface ParamsQueryTxs {
    txStatus?: TxStatus;
    offset?: Marshalled<PackPrimitive.U32>;
    limit?: Marshalled<PackPrimitive.U32>;
    latest?: Marshalled<PackPrimitive.Bool>;
}

export interface TransactionInput<
    Input extends TypedPackValue = TypedPackValue,
> {
    hash: string;
    version: string;
    selector: string;
    in: Input;
}

export interface TransactionOutput<
    Input extends TypedPackValue,
    Output extends TypedPackValue,
> extends TransactionInput<Input> {
    out: Output;
}

// ParamsSubmitTx defines the parameters of the MethodSubmitTx.
export interface ParamsSubmitTx<T extends TransactionInput = TransactionInput> {
    // Tx being submitted.
    tx: T;
    // Tags that should be attached to the Tx.
    // tags: Array<Marshalled<PackPrimitive.Bytes32>>;
}

// ParamsQueryTx defines the parameters of the MethodQueryTx.
export interface ParamsQueryTx {
    // TxHash of the transaction that will be returned.
    txHash: string;
}

// ResponseSubmitTx defines the response of the MethodSubmitTx.
export interface ResponseSubmitTx {}

// ResponseSubmitGateway defines the response of the MethodSubmitGateway.
export interface ResponseSubmitGateway {}

// ResponseQueryTx defines the response of the MethodQueryTx.
export interface ResponseQueryTx<
    Input extends TypedPackValue = TypedPackValue,
    Output extends TypedPackValue = TypedPackValue,
> {
    // Tx       abi.Tx`json:"tx"`
    tx: {
        version: "0" | "1";
        hash: string;
        selector: string;
        in: Input;
        out: Output;
    };
    // TxStatus string`json:"txStatus"`
    txStatus: TxStatus;
}

// ResponseQueryTxs defines the response of the MethodQueryTxs.
export interface ResponseQueryTxs {
    txs: Array<ResponseQueryTx["tx"]>;
}
