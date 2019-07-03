import { Ox, strip0x } from "../blockchain/common";
import { SECONDS, sleep } from "../lib/utils";
import { Token } from "../types/assets";
import { NetworkDetails } from "../types/networks";
import { Lightnode } from "./lightnode";
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
        throw new Error(`Unable to unmarshal value from Darknodes: ${JSON.stringify(value)} - ${error}`);
    }
};

export class RenVMNetwork {
    public lightnode: Lightnode;

    constructor(lightnodeURL: string) {
        this.lightnode = new Lightnode(lightnodeURL);
    }

    public submitMessage = async (action: Token, args: Args): Promise<string> => {
        const response = await this.lightnode.sendMessage({
            to: action,
            args,
        });

        if (!response.result) {
            throw new Error("Invalid message");
        }

        // tslint:disable-next-line:no-non-null-assertion
        return response.result.messageID;
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
            { name: "token", type: "b20", value: Buffer.from(strip0x(network.zBTC), "hex").toString("base64") },
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
            const response = await this.lightnode.receiveMessage({ messageID }) as ShifterResponse;
            if (response.result && response.result.out) {
                let ret = {};
                for (const value of response.result.out) {
                    ret = { ...ret, [value.name]: decodeValue(value) };
                }
                return ret as ShiftedInResponse | ShiftedOutResponse;
            } else if (response.error) {
                throw response.error;
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
