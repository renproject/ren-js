import { Ox, strip0x } from "../blockchain/common";
import { SECONDS, sleep } from "../lib/utils";
import { Token } from "../types/assets";
import { NetworkDetails } from "../types/networks";
import { decodeValue } from "./jsonRPC";
import { RPCMethod } from "./renNode";
import { RenVMNetwork } from "./renVMNetwork";
import {
    QueryBurnResponse, QueryTxRequest, QueryTxResponse, SubmitBurnRequest, SubmitMintRequest,
    SubmitTxResponse, Tx, TxStatus,
} from "./transaction";

const ErrInvalidResponse = `Invalid response from RenVM`;

const unmarshalTx = (response: QueryTxResponse): Tx => {
    // Unmarshal
    let args = {};
    for (const value of response.tx.args) {
        args = { ...args, [value.name]: decodeValue(value) };
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
    public network: RenVMNetwork;

    constructor(nodeURLs: string[]) {
        this.network = new RenVMNetwork(nodeURLs);
    }

    public submitShiftIn = async (
        action: Token,
        to: string,
        amount: number,
        nonce: string,
        pHash: string,
        utxoTxHash: string,
        utxoVout: number,
        network: NetworkDetails,
    ): Promise<string> => {
        const response = await this.network.broadcastMessage<SubmitMintRequest, SubmitTxResponse>(RPCMethod.SubmitTx,
            {
                tx: {
                    to: action,
                    args: [
                        // The hash of the payload data
                        { name: "phash", type: "b32", value: Buffer.from(strip0x(pHash), "hex").toString("base64") },
                        // The amount of BTC (in SATs) that has be transferred to the gateway
                        { name: "amount", type: "u64", value: amount },
                        // The ERC20 contract address on Ethereum for ZBTC
                        { name: "token", type: "b20", value: Buffer.from(strip0x(network.contracts.addresses.shifter.zBTC.address), "hex").toString("base64") },
                        // The address on the Ethereum blockchain to which ZBTC will be transferred
                        { name: "to", type: "b20", value: Buffer.from(strip0x(to), "hex").toString("base64") },
                        // The nonce is used to randomize the gateway
                        { name: "n", type: "b32", value: Buffer.from(strip0x(nonce), "hex").toString("base64") },

                        // UTXO
                        {
                            name: "utxo",
                            type: "ext_btcCompatUTXO",
                            value: {
                                txHash: Buffer.from(strip0x(utxoTxHash), "hex").toString("base64"),
                                vOut: utxoVout,
                            }
                        },
                    ],
                }
            });

        if (!response.result) {
            throw new Error(response.error || ErrInvalidResponse);
        }

        return Ox(Buffer.from(response.result.tx.hash, "base64"));
    }

    public queryShiftIn = async (utxoTxHash: string, onStatus?: (status: TxStatus) => void): Promise<Tx> => {
        let response: QueryTxResponse;
        // tslint:disable-next-line: no-constant-condition
        while (true) {
            try {
                const result = await this.network.broadcastMessage<QueryTxRequest, QueryTxResponse>(
                    RPCMethod.QueryTx,
                    {
                        txHash: Buffer.from(strip0x(utxoTxHash), "hex").toString("base64"),
                    },
                );
                if (result.result && result.result.txStatus === TxStatus.TxStatusDone) {
                    response = result.result;
                    break;
                } else if (onStatus && result.result && result.result.txStatus) {
                    onStatus(result.result.txStatus);
                }
            } catch (error) {
                console.error(String(error));
                // TODO: Ignore "result not available",
                // throw otherwise
            }
            await sleep(5 * SECONDS);
        }
        return unmarshalTx(response);
    }

    public submitShiftOut = async (action: Token, ref: string): Promise<string> => {
        const response = await this.network.broadcastMessage<SubmitBurnRequest, SubmitTxResponse>(RPCMethod.SubmitTx,
            {
                tx: {
                    to: action,
                    args: [
                        { name: "ref", type: "u64", value: parseInt(ref, 16) },
                    ],
                }
            });

        if (!response.result) {
            throw new Error(response.error || ErrInvalidResponse);
        }

        return Ox(Buffer.from(response.result.tx.hash, "base64"));
    }

    public queryShiftOut = async (utxoTxHash: string, onStatus?: (status: TxStatus) => void): Promise<QueryBurnResponse> => {
        let response: QueryBurnResponse;
        // tslint:disable-next-line: no-constant-condition
        while (true) {
            try {
                const result = await this.network.broadcastMessage<QueryTxRequest, QueryTxResponse>(
                    RPCMethod.QueryTx,
                    {
                        txHash: Buffer.from(strip0x(utxoTxHash), "hex").toString("base64"),
                    },
                );
                if (result.result && result.result.txStatus === TxStatus.TxStatusDone) {
                    response = result.result;
                    break;
                } else if (onStatus && result.result && result.result.txStatus) {
                    onStatus(result.result.txStatus);
                }
            } catch (error) {
                console.error(String(error));
                // TODO: Ignore "result not available",
                // throw otherwise
            }
            await sleep(5 * SECONDS);
        }

        return response;
    }
}
