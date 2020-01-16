import { getTokenAddress, Ox, SECONDS, sleep, strip0x } from "../lib/utils";
import { Asset, parseRenContract, RenContract } from "../types/assets";
import { NetworkDetails } from "../types/networks";
import { DarknodeGroup } from "./darknodeGroup";
import { decodeValue, RPCMethod } from "./jsonRPC";
import {
    QueryBurnResponse, QueryTxRequest, QueryTxResponse, SubmitBurnRequest, SubmitMintRequest,
    SubmitTxResponse, Tx, TxStatus,
} from "./transaction";

export const unmarshalTx = (response: QueryTxResponse): Tx => {
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
        const response = await this.network.sendMessage<SubmitMintRequest, SubmitTxResponse>(RPCMethod.SubmitTx,
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
        const response = await this.network.sendMessage<SubmitBurnRequest, SubmitTxResponse>(RPCMethod.SubmitTx,
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

    public readonly queryTX = async <T extends QueryBurnResponse | QueryTxResponse>(utxoTxHash: string): Promise<T> => {
        return await this.network.sendMessage<QueryTxRequest, QueryTxResponse>(
            RPCMethod.QueryTx,
            {
                txHash: Buffer.from(strip0x(utxoTxHash), "hex").toString("base64"),
            },
        ) as T;
    }

    public readonly waitForTX = async <T extends QueryBurnResponse | QueryTxResponse>(utxoTxHash: string, onStatus?: (status: TxStatus) => void): Promise<T> => {
        let response: T;
        // tslint:disable-next-line: no-constant-condition
        while (true) {
            try {
                const result = await this.queryTX(utxoTxHash);
                if (result && result.txStatus === TxStatus.TxStatusDone) {
                    response = result as T;
                    break;
                } else if (onStatus && result && result.txStatus) {
                    onStatus(result.txStatus);
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
