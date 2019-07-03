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

type ShifterResponse = JSONRPCResponse<{
    out: [
        {
            "type": "u64",
            "name": "amount",
            "value": string, // "8d8126"
        },
        {
            "type": "b20",
            "name": "txHash",
            "value": string, // "18343428f9b057102c4a6da8d8011514a5ea8be2f44af636bcd26a8ae4e2b719"
        },
        {
            "type": "b20",
            "name": "r",
            "value": string, // "c762164060c7bbffbd0a76335d02ca8e69f792b13d8eb865a09690cc30aaf55e"
        },
        {
            "type": "b20",
            "name": "s",
            "value": string, // "b3785c63afb91bb58e98a89552fdf3cb6034e5f349ab1f37f67d9e314fd4f506"
        },
        {
            "type": "b20",
            "name": "v",
            "value": string, // "01"
        }
    ],
}>;

export class Shifter {
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

    public submitDeposits = async (action: Token, to: string, amount: number, nonce: string, pHash: string, hash: string, network: NetworkDetails): Promise<string> => {
        return this.submitMessage(action, [
            { name: "phash", type: "b32", value: Buffer.from(strip0x(pHash), "hex").toString("base64") },
            { name: "amount", type: "u64", value: amount },
            { name: "token", type: "b20", value: Buffer.from(strip0x(network.zBTC), "hex").toString("base64") },
            { name: "to", type: "b20", value: Buffer.from(strip0x(to), "hex").toString("base64") },
            { name: "n", type: "b32", value: Buffer.from(strip0x(nonce), "hex").toString("base64") },
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
                    ret = { ...ret, [value.name]: value.type === "u64" ? value.value : Ox(Buffer.from(value.value, "base64")) };
                }
                return ret as ShiftedInResponse | ShiftedOutResponse;
            } else if (response.error) {
                throw response.error;
            }
        } catch (error) {
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
