import { soliditySha3 } from "web3-utils";

import { actionToDetails, Chain, ShiftAction } from "./assets";
import { BitcoinUTXO, createBTCTestnetAddress, getBTCTestnetUTXOs } from "./blockchain/btc";
import { createZECTestnetAddress, getZECTestnetUTXOs, ZcashUTXO } from "./blockchain/zec";

export type UTXO = { chain: Chain.Bitcoin, utxo: BitcoinUTXO } | { chain: Chain.ZCash, utxo: ZcashUTXO };

export interface Param {
    type: string;
    // tslint:disable-next-line: no-any
    value: any;
}

export type Payload = Param[];

// tslint:disable-next-line: no-any
export const hashPayload = (...zip: Param[] | [Param[]]): string => {
    // You can annotate values passed in to soliditySha3.
    // Example: { type: "address", value: srcToken }
    // const zip = values.map((value, i) => ({ type: types[i], value }));

    // Check if they called as hashPayload([...]) instead of hashPayload(...)
    const params = Array.isArray(zip) ? zip[0] as any as Param[] : zip; // tslint:disable-line: no-any
    return soliditySha3(...params);
};

// Generates the gateway address
export const generateAddress = (_to: string, _shiftAction: ShiftAction, _payload: Payload): string => {
    const chain = actionToDetails(_shiftAction).from;
    switch (chain) {
        case Chain.Bitcoin:
            return createBTCTestnetAddress(_to, hashPayload(_payload));
        case Chain.ZCash:
            return createZECTestnetAddress(_to, hashPayload(_payload));
        default:
            throw new Error(`Unable to generate deposit address for chain ${chain}`);
    }
};

// Retrieves unspent deposits at the provided address
export const retrieveDeposits = async (_shiftAction: ShiftAction, _depositAddress: string, _limit = 10, _confirmations = 0): Promise<UTXO[]> => {
    const chain = actionToDetails(_shiftAction).from;
    switch (chain) {
        case Chain.Bitcoin:
            return (await getBTCTestnetUTXOs(_depositAddress, _limit, _confirmations)).map(utxo => ({ chain: Chain.Bitcoin, utxo }));
        case Chain.ZCash:
            return (await getZECTestnetUTXOs(_depositAddress, _limit, _confirmations)).map(utxo => ({ chain: Chain.ZCash, utxo }));
        default:
            throw new Error(`Unable to retrieve deposits for chain ${chain}`);
    }
};

export const SECONDS = 1000;
// tslint:disable-next-line: no-string-based-set-timeout
export const sleep = async (timeout: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, timeout));
