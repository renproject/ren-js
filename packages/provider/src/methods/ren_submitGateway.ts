import {
    Marshalled,
    PackPrimitive,
    PackTypeDefinition,
    TypedPackValue,
} from "@renproject/utils";

export interface SubmitGatewayInput {
    version: string;
    selector: string;
    in: SubmitGateway;
}

export const submitGatewayType: PackTypeDefinition = {
    struct: [
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

export type SubmitGateway = TypedPackValue<
    // Types
    typeof submitGatewayType,
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

export type ParamsSubmitGateway = {
    gateway: string;
    tx: SubmitGatewayInput;
};
