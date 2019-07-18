import { List } from "immutable";

import { Ox, strip0x } from "../blockchain/common";
import { SECONDS, sleep } from "../lib/utils";
import { Token } from "../types/assets";
import { NetworkDetails } from "../types/networks";
import { decodeValue, JSONRPCResponse } from "./jsonRPC";
import { RenNode } from "./renNode";
import { QueryTxResponse, SubmitTxResponse, Tx, TxArgsArray, TxStatus } from "./transaction";

const promiseAll = async <a>(list: List<Promise<a>>, defaultValue: a): Promise<List<a>> => {
    let errors = new Set<string>();
    let newList = List<a>();
    for (const entryP of list.toArray()) {
        try {
            newList = newList.push(await entryP);
        } catch (error) {
            const errorString = String(error);
            if (!errors.has(errorString)) {
                errors.add(errorString);
                console.error(errorString);
            }
            newList = newList.push(defaultValue);
        }
    }
    return newList;
};

export class RenVMNetwork {
    public nodes: List<RenNode>;

    constructor(nodeURLs: string[]) {
        this.nodes = List(nodeURLs.map(nodeURL => new RenNode(nodeURL)));
    }

    public submitTx = async (action: Token, args: TxArgsArray): Promise<JSONRPCResponse<SubmitTxResponse>> => {

        const responses = (await promiseAll(
            this.nodes.valueSeq().map(async (node) => {
                const response = await node.submitTx({
                    tx: {
                        to: action,
                        args,
                    }
                });
                if (!response.result || response.error) {
                    throw new Error(response.error.message || response.error) || new Error(`Invalid message`);
                }
                return response;
            }).toList(),
            null
        )).filter((result) => result !== null);

        const first = responses.first(null);
        if (first === null) {
            throw new Error("No response from RenVM while submitting message");
        }

        return first;
    }

    public submitDeposits = async (
        action: Token,
        to: string,
        amount: number,
        nonce: string,
        pHash: string,
        utxoTxHash: string,
        utxoVout: number,
        network: NetworkDetails,
    ): Promise<string> => {
        console.log(`Submitting utxo # ${utxoVout} ${utxoTxHash} (${Buffer.from(strip0x(utxoTxHash), "hex").toString("base64")})`);
        const response = await this.submitTx(action, [
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
        ]);

        console.log(JSON.stringify(response));

        if (!response.result) {
            throw new Error(response.error || `Invalid response from RenVM`);
        }

        return Ox(Buffer.from(response.result.tx.hash, "base64"));
    }

    public submitWithdrawal = async (action: Token, ref: string): Promise<string> => {
        throw new Error("Not implemented.");
        // return this.submitTx(action, [
        //     { name: "ref", type: "u64", value: parseInt(ref, 16) },
        // ]);
    }

    public checkForResponse = async (utxoTxHash: string): Promise<Tx> => {
        try {

            const responses = (await promiseAll(
                this.nodes.valueSeq().map(async (node) => {
                    const query = {
                        txHash: Buffer.from(strip0x(utxoTxHash), "hex").toString("base64"),
                    };
                    console.log(`\n\nquery: ${JSON.stringify(query)}`);
                    const response = await node.queryTx(query) as JSONRPCResponse<QueryTxResponse>;
                    console.log(`response: ${JSON.stringify(response)}\n\n`);
                    if (!response.result || response.error) {
                        throw new Error(response.error.message || JSON.stringify(response.error));
                    }
                    return response;
                }).toList(),
                null,
            )).filter((result) => result !== null);

            const first = responses.first(null);
            if (first === null) {
                throw new Error("No response from RenVM while retrieving result");
            }

            if (first.result.txStatus === TxStatus.TxStatusDone && first.result.tx.out) {
                let args = {};
                for (const value of first.result.tx.args) {
                    args = { ...args, [value.name]: decodeValue(value) };
                }
                let signature = {};
                for (const value of first.result.tx.out) {
                    signature = { ...signature, [value.name]: decodeValue(value) };
                }
                // tslint:disable-next-line: no-object-literal-type-assertion
                return {
                    hash: Ox(Buffer.from(first.result.tx.hash, "base64")),
                    args,
                    signature,
                } as Tx;
            } else if (first.error) {
                throw first.error;
            }
        } catch (error) {
            // tslint:disable-next-line: no-console
            console.error(String(error));
        }
        throw new Error(`Signature not available`);
    }

    public waitForResponse = async (messageID: string): Promise<Tx> => {
        let response: Tx | undefined;
        while (!response) {
            try {
                response = await this.checkForResponse(messageID);
                if (response) {
                    break;
                }
            } catch (error) {
                console.error(String(error));
                await sleep(5 * SECONDS);
                // TODO: Ignore "result not available",
                // throw otherwise
            }
        }
        return response;
    }

}
