import { Asset, Ox, RenContract, strip0x, TxStatus } from "@renproject/ren-js-common";

import { getTokenAddress, SECONDS, sleep } from "../lib/utils";
import { parseRenContract } from "../types/assets";
import { NetworkDetails } from "../types/networks";
import { DarknodeGroup } from "./darknodeGroup";
import { decodeValue, ResponseQueryTx, RPCMethod } from "./jsonRPC";
import { Tx } from "./transaction";

export const unmarshalTx = (response: ResponseQueryTx): Tx => {
    // Unmarshal
    let args = {};
    for (const value of response.tx.args) {
        args = { ...args, [value.name]: decodeValue<typeof value["name"], typeof value["type"], typeof value["value"]>(value) };
    }
    let signature = {};
    for (const value of response.tx.out) {
        signature = { ...signature, [value.name]: decodeValue(value) };
    }
    // tslint:disable-next-line: no-object-literal-type-assertion
    return {
        hash: Ox(Buffer.from(response.tx.hash, "base64")),
        args,
        signature,
    } as Tx;
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
        const token = getTokenAddress(renContract, network);
        let utxoType: "ext_btcCompatUTXO" | "ext_zecCompatUTXO";
        switch (parseRenContract(renContract).asset) {
            case Asset.BTC:
                utxoType = "ext_btcCompatUTXO";
                break;
            case Asset.ZEC:
                utxoType = "ext_btcCompatUTXO"; // "ext_zecCompatUTXO";
                break;
            case Asset.BCH:
                utxoType = "ext_btcCompatUTXO";
                break;
            default:
                throw new Error(`Unsupported action ${renContract}`);
        }
        const response = await this.network.sendMessage(RPCMethod.SubmitTx,
            {
                tx: {
                    to: renContract,
                    args: [
                        // The hash of the payload data
                        { name: "phash", type: "b32", value: Buffer.from(strip0x(pHash), "hex").toString("base64") },
                        // The amount of BTC (in SATs) that has be transferred to the gateway
                        { name: "amount", type: "u64", value: amount },
                        // The ERC20 contract address on Ethereum for zBTC
                        { name: "token", type: "b20", value: Buffer.from(strip0x(token), "hex").toString("base64") },
                        // The address on the Ethereum blockchain to which ZBTC will be transferred
                        { name: "to", type: "b20", value: Buffer.from(strip0x(to), "hex").toString("base64") },
                        // The nonce is used to randomize the gateway
                        { name: "n", type: "b32", value: Buffer.from(strip0x(nonce), "hex").toString("base64") },

                        // UTXO
                        {
                            name: "utxo",
                            type: utxoType,
                            value: {
                                txHash: Buffer.from(strip0x(utxoTxHash), "hex").toString("base64"),
                                vOut: utxoVout,
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
                    args: [
                        { name: "ref", type: "u64", value: parseInt(ref, 16) },
                    ],
                }
            });

        return Ox(Buffer.from(response.tx.hash, "base64"));
    }

    public readonly queryTX = async (utxoTxHash: string): Promise<ResponseQueryTx> => {
        return await this.network.sendMessage(
            RPCMethod.QueryTx,
            {
                txHash: Buffer.from(strip0x(utxoTxHash), "hex").toString("base64"),
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
