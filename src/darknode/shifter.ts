import { ZBTC_ADDRESS } from "utils";

import { Ox, strip0x } from "../blockchain/common";
import { ShiftAction } from "../index";
import { Lightnode } from "./lightnode";
import { Args, JSONRPCResponse } from "./types";

const _testnetLightnode = "https://lightnode-testnet.herokuapp.com";

const _devnetLightnode = "https://lightnode-devnet.herokuapp.com";

export const lightnode = _devnetLightnode; // TODO: Change this back

export interface ShiftedInResponse {
    r: string;
    s: string;
    v: string;
    token: string;
    to: string;
    amount: number;
    phash: string;
    nonce: string;
    hash: string;
}

export interface ShiftedOutResponse {
    amount: string;
    txHash: string;
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

    public submitMessage = async (action: ShiftAction, args: Args): Promise<string> => {
        const response = await this.lightnode.sendMessage({
            to: action,
            args,
        });

        console.log(response);

        if (!response.result) {
            throw new Error("Invalid message");
        }

        // tslint:disable-next-line:no-non-null-assertion
        return response.result.messageID;
    }

    public submitDeposits = async (action: ShiftAction, to: string, amount: number, nonce: string, pHash: string, hash: string): Promise<string> => {
        return this.submitMessage(action, [
            { name: "token", type: "b20", value: Buffer.from(strip0x(ZBTC_ADDRESS), "hex").toString("base64") },
            { name: "to", type: "b20", value: Buffer.from(strip0x(to), "hex").toString("base64") },
            { name: "amount", type: "u64", value: amount },
            { name: "phash", type: "b32", value: Buffer.from(strip0x(pHash), "hex").toString("base64") },
            { name: "nonce", type: "b32", value: Buffer.from(strip0x(nonce), "hex").toString("base64") },
            { name: "hash", type: "b32", value: Buffer.from(strip0x(hash), "hex").toString("base64") },
        ]);
    }

    public submitWithdrawal = async (action: ShiftAction, to: string, amount: number): Promise<string> => {
        return this.submitMessage(action, [
            { name: "to", type: "b20", value: Buffer.from(strip0x(ZBTC_ADDRESS), "hex").toString("base64") },
            { name: "amount", type: "u64", value: amount },
        ]);
    }

    public checkForResponse = async (messageID: string): Promise<ShiftedInResponse | ShiftedOutResponse> => {
        try {
            const response = await this.lightnode.receiveMessage({ messageID }) as ShifterResponse;
            if (response.result && response.result.out) {
                let ret = {};
                for (const value of response.result.out) {
                    ret = { ...ret, [value.name]: value.type === "u64" ? value.value : Ox(Buffer.from(value.value, "base64").toString("hex")) };
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
}
