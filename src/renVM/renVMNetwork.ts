import { List } from "immutable";

import { Ox, strip0x } from "../blockchain/common";
import { SECONDS, sleep } from "../lib/utils";
import { Token } from "../types/assets";
import { NetworkDetails } from "../types/networks";
import { RenNode } from "./renNode";
import { Args, JSONRPCResponse } from "./types";

export interface ShiftedInResponse {
    r: string;
    s: string;
    v: string;
    phash: string;
    amount: number;
    token: string;
    to: string;
    nhash: string;
    hash: string;
    ghash: string;
}

export interface ShiftedOutResponse {
    amount: number;
    to: string;
    ref: number;
}

interface Type<type extends string, name extends string, valueType> {
    "type": type;
    "name": name;
    "value": valueType; // "8d8126"
}

type ShifterResponse = JSONRPCResponse<{
    out: [
        Type<"u64", "amount", string>, // "8d8126"
        Type<"b20", "txHash", string>, // "18343428f9b057102c4a6da8d8011514a5ea8be2f44af636bcd26a8ae4e2b719"
        Type<"b20", "r", string>, // "c762164060c7bbffbd0a76335d02ca8e69f792b13d8eb865a09690cc30aaf55e"
        Type<"b20", "s", string>, // "b3785c63afb91bb58e98a89552fdf3cb6034e5f349ab1f37f67d9e314fd4f506"
        Type<"b20", "v", string>, // "01"
    ],
}>;

// tslint:disable-next-line: no-any
const decodeValue = (value: Type<string, string, any>) => {
    try {
        return value.type.match(/u[0-9]+/) ? value.value : Ox(Buffer.from(value.value, "base64"));
    } catch (error) {
        throw new Error(`Unable to unmarshal value from RenVM: ${JSON.stringify(value)} - ${error}`);
    }
};

const promiseAll = async <a>(list: List<Promise<a>>, defaultValue: a): Promise<List<a>> => {
    let newList = List<a>();
    for (const entryP of list.toArray()) {
        try {
            newList = newList.push(await entryP);
        } catch (error) {
            console.error(error);
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

    public submitMessage = async (action: Token, args: Args): Promise<string> => {

        const responses = (await promiseAll(
            this.nodes.valueSeq().map(async (node) => {
                const response = await node.sendMessage({
                    to: action,
                    args,
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

        // tslint:disable-next-line:no-non-null-assertion
        return first.result.messageID;
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
        return this.submitMessage(action, [
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

            // The tx hash of the gateway address' utxo
            { name: "utxoTxHash", type: "b32", value: Buffer.from(strip0x(utxoTxHash), "hex").toString("base64") },
            // The output index of the gateway address' utxo
            { name: "utxoVout", type: "u32", value: utxoVout },
        ]);
    }

    public submitWithdrawal = async (action: Token, ref: string): Promise<string> => {
        return this.submitMessage(action, [
            { name: "ref", type: "u64", value: parseInt(ref, 16) },
        ]);
    }

    public checkForResponse = async (messageID: string): Promise<ShiftedInResponse | ShiftedOutResponse> => {
        try {

            const responses = (await promiseAll(
                this.nodes.valueSeq().map(async (node) => {
                    const response = await node.receiveMessage({ messageID }) as ShifterResponse;
                    if (!response.result || response.error) {
                        throw new Error(response.error);
                    }
                    return response;
                }).toList(),
                null,
            )).filter((result) => result !== null);

            const first = responses.first(null);
            if (first === null) {
                throw new Error("No response from RenVM while retrieving result");
            }

            if (first.result && first.result.out) {
                let ret = {};
                for (const value of first.result.out) {
                    ret = { ...ret, [value.name]: decodeValue(value) };
                }
                return ret as ShiftedInResponse | ShiftedOutResponse;
            } else if (first.error) {
                throw first.error;
            }
        } catch (error) {
            // tslint:disable-next-line: no-console
            console.error(error);
        }
        throw new Error(`Signature not available`);
    }

    public waitForResponse = async (messageID: string): Promise<ShiftedInResponse | ShiftedOutResponse> => {
        let response: ShiftedInResponse | ShiftedOutResponse | undefined;
        while (!response) {
            try {
                response = await this.checkForResponse(messageID) as ShiftedInResponse;
                if (response) {
                    break;
                }
            } catch (error) {
                await sleep(5 * SECONDS);
                // TODO: Ignore "result not available",
                // throw otherwise
            }
        }
        return response;
    }

}
