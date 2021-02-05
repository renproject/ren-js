import { toURLBase64 } from "@renproject/utils";
import { expect } from "earljs";
import { describe, it } from "mocha";

import { PackPrimitive } from "../src/v2/pack/pack";
import { hashTransaction } from "../src/v2/transaction";

export const submit = {
    jsonrpc: "2.0",
    id: 1,
    method: "ren_submitTx",
    params: {
        tx: {
            hash: "Dch8cmwnwL0QIUrSk2EhBQ3DY4cixzVp_AKYaaZ9Xvc",
            version: "1",
            selector: "BTC/toEthereum",
            in: {
                t: {
                    struct: [
                        {
                            output: {
                                struct: [
                                    {
                                        outpoint: {
                                            struct: [
                                                {
                                                    hash: PackPrimitive.Bytes,
                                                },
                                                {
                                                    index: PackPrimitive.U32,
                                                },
                                            ],
                                        },
                                    },
                                    {
                                        value: PackPrimitive.U256,
                                    },
                                    {
                                        pubKeyScript: PackPrimitive.Bytes,
                                    },
                                ],
                            },
                        },
                        {
                            payload: PackPrimitive.Bytes,
                        },
                        {
                            phash: PackPrimitive.Bytes32,
                        },
                        {
                            token: PackPrimitive.Str,
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
                            ghash: PackPrimitive.Bytes32,
                        },
                        {
                            gpubkey: PackPrimitive.Bytes,
                        },
                    ],
                },
                v: {
                    ghash: "U-DBJ9vAHUa5tB4mmOyw_tLyyV0-1dVfzXZoVD8JXGs",
                    gpubkey: "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
                    nhash: "mDuJVJM18Jbn01yyLwvq-UmRqgg37N4U4yYZsJHCPkU",
                    nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                    output: {
                        outpoint: {
                            hash: "uqU05-w6XPeJFbzvdyb_nQot3ueKabkNHrc5ez1xcFI",
                            index: "0",
                        },
                        pubKeyScript: "qRTGFsF0Ojzcp1YYS-0GOnAZdouRA4c",
                        value: "10000",
                    },
                    payload: "",
                    phash: "xdJGAYb3IzySfn2y3McDwOUAtlPKgic7e_rYBF2FpHA",
                    to: "9e3feaf5f0483b2e196db31635734f627fdfd254",
                    token: "B116c1a20647D5d1dD662C2f2B10C0a4A6124794",
                },
            },
            out: {
                t: {
                    struct: [],
                },
                v: {},
            },
        },
    },
};

describe("Pack", () => {
    it("Marshal pack value", () => {
        const { selector, hash, version } = submit.params.tx;
        const txIn = submit.params.tx.in;

        const actualHash = toURLBase64(
            hashTransaction(version, selector, txIn),
        );
        expect(actualHash).toEqual(hash);
    });
});
