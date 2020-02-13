import {
    Chain, Ox, RenContract, RenVMArg, RenVMType, strip0x, Tokens, TxStatus, UnmarshalledBurnTx,
    UnmarshalledMintTx,
} from "@renproject/ren-js-common";
import BigNumber from "bignumber.js";

import { assert, SECONDS, sleep, syncGetTokenAddress, toBase64, utils } from "../lib/utils";
import { parseRenContract } from "../types/assets";
import { NetworkDetails } from "../types/networks";
import { DarknodeGroup } from "./darknodeGroup";
import { ResponseQueryBurnTx, ResponseQueryMintTx, RPCMethod } from "./jsonRPC";

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
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value> ? RenVMArg<Name, Type, Value> : never
): ArgType extends RenVMArg<infer _Name, infer _Type, infer Value> ? Value : never => {
    assert(arg.type === type, `Expected argument ${name} of type ${type} but got ${arg.name} of type ${arg.type}`);
    return arg.value;
};

const assertAndDecodeBytes = <ArgType>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value> ? Value extends string ? RenVMArg<Name, Type, Value> : never : never
): string => {
    return decodeBytes(assertArgumentType<ArgType>(name, type, arg));
};

const assertAndDecodeNumber = <ArgType>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value> ? Value extends string ? RenVMArg<Name, Type, Value> : never : never
): BigNumber => {
    return decodeNumber(assertArgumentType<ArgType>(name, type, arg));
};

const assertAndDecodeAddress = <ArgType>(
    name: ArgType extends RenVMArg<infer Name, infer _Type> ? Name : never,
    type: ArgType extends RenVMArg<infer _Name, infer Type> ? Type : never,
    arg: ArgType extends RenVMArg<infer Name, infer Type, infer Value> ? Value extends string ? RenVMArg<Name, Type, Value> : never : never
): string => {
    return Ox(assertArgumentType<ArgType>(name, type, arg));
};

export const unmarshalMintTx = (response: ResponseQueryMintTx): UnmarshalledMintTx => {
    // Note: Numbers are decoded and re-encoded to ensure they are in the correct format.

    assert(parseRenContract(response.tx.to).to === Chain.Ethereum, `Expected mint details but got back burn details (${response.tx.hash} - ${response.tx.to})`);

    const [phashArg, tokenArg, toArg, nArg, utxoArg, amountArg] = response.tx.in;
    const phash = assertAndDecodeBytes<typeof phashArg>("phash", RenVMType.TypeB32, phashArg);
    const token = assertAndDecodeAddress<typeof tokenArg>("token", RenVMType.ExtTypeEthCompatAddress, tokenArg);
    const to = assertAndDecodeAddress<typeof toArg>("to", RenVMType.ExtTypeEthCompatAddress, toArg);
    const n = assertAndDecodeBytes<typeof nArg>("n", RenVMType.TypeB32, nArg);
    const utxoRaw = assertArgumentType<typeof utxoArg>("utxo", utxoArg.type, utxoArg);
    const amount = assertAndDecodeNumber<typeof amountArg>("amount", RenVMType.TypeU256, amountArg).toFixed();

    const utxo = { "txHash": decodeBytes(utxoRaw.txHash), "vOut": parseInt(utxoRaw.vOut, 10), "scriptPubKey": decodeBytes(utxoRaw.scriptPubKey), "amount": decodeNumber(utxoRaw.amount).toFixed() };

    const [ghashArg, nhashArg, sighashArg] = response.tx.autogen;
    const ghash = assertAndDecodeBytes<typeof ghashArg>("ghash", RenVMType.TypeB32, ghashArg);
    const nhash = assertAndDecodeBytes<typeof nhashArg>("nhash", RenVMType.TypeB32, nhashArg);
    const sighash = assertAndDecodeBytes<typeof sighashArg>("sighash", RenVMType.TypeB32, sighashArg);

    let out: UnmarshalledMintTx["out"];
    if (response.tx.out) {
        const [rArg, sArg, vArg] = response.tx.out;
        const r = assertAndDecodeBytes<typeof rArg>("r", RenVMType.TypeB, rArg);
        const s = assertAndDecodeBytes<typeof sArg>("s", RenVMType.TypeB, sArg);
        const v = assertAndDecodeBytes<typeof vArg>("v", RenVMType.TypeB, vArg);
        out = { r, s, v };
    }

    return {
        hash: decodeBytes(response.tx.hash),
        txStatus: response.txStatus,
        to: response.tx.to,
        in: { phash, token, to, n, utxo, amount },
        autogen: { sighash, ghash, nhash },
        out,
    };
};

export const unmarshalBurnTx = (response: ResponseQueryBurnTx): UnmarshalledBurnTx => {

    assert(parseRenContract(response.tx.to).from === Chain.Ethereum, `Expected burn details but got back mint details (${response.tx.hash} - ${response.tx.to})`);

    const [refArg, toArg, amountArg] = response.tx.in;
    const ref = assertAndDecodeNumber<typeof refArg>("ref", RenVMType.TypeU64, refArg).toFixed();
    const toRaw = assertArgumentType<typeof toArg>("to", RenVMType.TypeB, toArg);
    let amount;
    try {
        amount = assertAndDecodeNumber<typeof amountArg>("amount", RenVMType.TypeU256, amountArg).toFixed();
    } catch (error) {
        amount = assertAndDecodeNumber<typeof amountArg>("amount", RenVMType.TypeU64, amountArg).toFixed();
    }

    const to = response.tx.to === Tokens.ZEC.Eth2Zec ?
        utils.zec.addressFrom(toRaw) :
        response.tx.to === Tokens.BCH.Eth2Bch ?
            utils.bch.addressFrom(toRaw) :
            utils.btc.addressFrom(toRaw);

    return {
        hash: decodeBytes(response.tx.hash),
        to: response.tx.to,
        in: { ref, to, amount },
    };
};

export const unmarshalTx = ((response: ResponseQueryMintTx | ResponseQueryBurnTx): UnmarshalledMintTx | UnmarshalledBurnTx => {
    if (parseRenContract(response.tx.to).to === Chain.Ethereum) {
        return unmarshalMintTx(response as ResponseQueryMintTx);
    } else {
        return unmarshalBurnTx(response as ResponseQueryBurnTx);
    }
});

export class ShifterNetwork {
    public network: DarknodeGroup;

    constructor(network: DarknodeGroup) {
        this.network = network;
    }

    public submitShiftIn = async (
        renContract: RenContract,
        to: string,
        nonce: string,
        pHash: string,
        utxoTxHash: string,
        utxoVout: string,
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
                                vOut: utxoVout,
                            }
                        },
                    ],
                }
            });

        return response.tx.hash;
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

        return response.tx.hash;
    }

    public readonly queryTX = async <T extends ResponseQueryMintTx | ResponseQueryBurnTx>(utxoTxHash: string): Promise<T> => {
        return await this.network.sendMessage(
            RPCMethod.QueryTx,
            {
                txHash: toBase64(utxoTxHash),
            },
        ) as T;
    }

    public readonly waitForTX = async <T extends ResponseQueryMintTx | ResponseQueryBurnTx>(utxoTxHash: string, onStatus?: (status: TxStatus) => void, _cancelRequested?: () => boolean): Promise<T> => {
        let response;
        // tslint:disable-next-line: no-constant-condition
        while (true) {
            if (_cancelRequested && _cancelRequested()) {
                throw new Error(`waitForTX cancelled`);
            }

            try {
                const result = await this.queryTX<T>(utxoTxHash);
                if (result && result.txStatus === TxStatus.TxStatusDone) {
                    response = result;
                    break;
                } else if (onStatus && result && result.txStatus) {
                    onStatus(result.txStatus);
                }
            } catch (error) {
                // tslint:disable-next-line: no-console
                if (String((error || {}).message).match(/(not found)|(not available)/)) {
                    // ignore
                } else {
                    console.error(String(error));
                    // TODO: throw unepected errors
                }
            }
            await sleep(5 * SECONDS);
        }
        return response;
    }
}
