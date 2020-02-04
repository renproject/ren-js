import { Ox, RenContract, RenVMArg, RenVMType, strip0x } from "@renproject/ren-js-common";
import BigNumber from "bignumber.js";

import { assert, SECONDS, sleep, syncGetTokenAddress, toBase64 } from "../lib/utils";
import { TxStatus } from "../types/assets";
import { NetworkDetails } from "../types/networks";
import { DarknodeGroup } from "./darknodeGroup";
import { ResponseQueryTx, RPCMethod } from "./jsonRPC";
import { UnmarshalledTx } from "./transaction";

const decodeBytes = (input: string) => Ox(Buffer.from(input, "base64"));
const decodeNumber = (input: string) => new BigNumber(input);

/**
 * Validate an argument returned from RenVM.
 * @param name The expected name.
 * @param type The expected type.
 * @param arg The actual argument returned.
 */
const assertArgumentType = <ArgType>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value> ? RenVMArg<Name, Type, Value> : never): ArgType extends RenVMArg<infer _Name, infer _Type, infer Value> ? Value : never => {
    assert(arg.type === type, `Expected argument ${name} of type ${type} but got ${arg.name} of type ${arg.type}`);
    return arg.value;
};

export const unmarshalTx = (response: ResponseQueryTx): UnmarshalledTx => {
    const [phashArg, tokenArg, toArg, nArg, utxoArg, amountArg] = response.tx.in;

    const phash = assertArgumentType<typeof phashArg>("phash", RenVMType.TypeB32, phashArg);
    const token = assertArgumentType<typeof tokenArg>("token", RenVMType.ExtTypeEthCompatAddress, tokenArg);
    const to = assertArgumentType<typeof toArg>("to", RenVMType.ExtTypeEthCompatAddress, toArg);
    const n = assertArgumentType<typeof nArg>("n", RenVMType.TypeB32, nArg);
    const utxo = assertArgumentType<typeof utxoArg>("utxo", utxoArg.type, utxoArg);
    const amount = assertArgumentType<typeof amountArg>("amount", RenVMType.TypeU256, amountArg);

    const [ghashArg, nhashArg, sighashArg] = response.tx.autogen;
    const ghash = assertArgumentType<typeof ghashArg>("ghash", RenVMType.TypeB32, ghashArg);
    const nhash = assertArgumentType<typeof nhashArg>("nhash", RenVMType.TypeB32, nhashArg);
    const sighash = assertArgumentType<typeof sighashArg>("sighash", RenVMType.TypeB32, sighashArg);

    let out: UnmarshalledTx["out"];
    if (response.tx.out) {
        const [rArg, sArg, vArg] = response.tx.out;
        const r = assertArgumentType<typeof rArg>("r", RenVMType.TypeB, rArg);
        const s = assertArgumentType<typeof sArg>("s", RenVMType.TypeB, sArg);
        const v = assertArgumentType<typeof vArg>("v", RenVMType.TypeB, vArg);
        out = {
            r: decodeBytes(r),
            s: decodeBytes(s),
            v: decodeBytes(v),
        };
    }

    return {
        hash: decodeBytes(response.tx.hash),
        to: response.tx.to,
        in: {
            phash: decodeBytes(phash),
            token: Ox(token),
            to: Ox(to),
            n: decodeBytes(n),
            utxo: { "txHash": utxo.txHash, "vOut": parseInt(utxo.vOut, 10), "scriptPubKey": utxo.scriptPubKey, "amount": decodeNumber(utxo.amount) },
            amount: decodeNumber(amount),
        },
        autogen: {
            sighash: decodeBytes(sighash),
            ghash: decodeBytes(ghash),
            nhash: decodeBytes(nhash),
        },
        out,
    };
};

export class ShifterNetwork {
    public network: DarknodeGroup;

    constructor(network: DarknodeGroup) {
        this.network = network;
    }

    public submitShiftIn = async (
        renContract: RenContract,
        to: string,
        amount: number,
        nonce: string,
        pHash: string,
        utxoTxHash: string,
        utxoVout: number,
        network: NetworkDetails,
    ): Promise<string> => {
        const token = syncGetTokenAddress(renContract, network);
        const response = await this.network.sendMessage(RPCMethod.SubmitTx,
            {
                tx: {
                    to: renContract,
                    in: [
                        // The hash of the payload data
                        { name: "phash", type: RenVMType.TypeB32, value: toBase64(pHash) },
                        // The amount of BTC (in SATs) that has be transferred to the gateway
                        // { name: "amount", type: "u64", value: amount },
                        // The ERC20 contract address on Ethereum for zBTC
                        { name: "token", type: RenVMType.ExtTypeEthCompatAddress, value: strip0x(token) },
                        // The address on the Ethereum blockchain to which ZBTC will be transferred
                        { name: "to", type: RenVMType.ExtTypeEthCompatAddress, value: strip0x(to) },
                        // The nonce is used to randomize the gateway
                        { name: "n", type: RenVMType.TypeB32, value: toBase64(nonce) },

                        // UTXO
                        {
                            name: "utxo",
                            type: RenVMType.ExtTypeBtcCompatUTXO,
                            value: {
                                txHash: toBase64(utxoTxHash),
                                vOut: utxoVout.toFixed(),
                            }
                        },
                    ],
                }
            });

        return Ox(Buffer.from(response.tx.hash, "base64"));
    }

    public submitShiftOut = async (renContract: RenContract, ref: string): Promise<string> => {
        const response = await this.network.sendMessage(RPCMethod.SubmitTx,
            {
                tx: {
                    to: renContract,
                    in: [
                        { name: "ref", type: RenVMType.TypeU64, value: ref },
                    ],
                }
            });

        return Ox(Buffer.from(response.tx.hash, "base64"));
    }

    public readonly queryTX = async (utxoTxHash: string): Promise<ResponseQueryTx> => {
        return await this.network.sendMessage(
            RPCMethod.QueryTx,
            {
                txHash: toBase64(utxoTxHash),
            },
        );
    }

    public readonly waitForTX = async (utxoTxHash: string, onStatus?: (status: TxStatus) => void, _cancelRequested?: () => boolean): Promise<ResponseQueryTx> => {
        let response;
        // tslint:disable-next-line: no-constant-condition
        while (true) {
            if (_cancelRequested && _cancelRequested()) {
                throw new Error(`waitForTX cancelled`);
            }

            try {
                const result = await this.queryTX(utxoTxHash);
                if (result && result.txStatus === TxStatus.TxStatusDone) {
                    response = result;
                    break;
                } else if (onStatus && result && result.txStatus) {
                    onStatus(result.txStatus);
                }
            } catch (error) {
                // tslint:disable-next-line: no-console
                console.error(String(error));
                // TODO: Ignore "result not available",
                // throw otherwise
            }
            await sleep(5 * SECONDS);
        }
        return response;
    }
}
