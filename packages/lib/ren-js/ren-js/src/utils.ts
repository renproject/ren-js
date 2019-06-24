import { crypto } from "bitcore-lib";
import { rawEncode } from "ethereumjs-abi";
import { keccak256 } from "web3-utils";

import { actionToDetails, Chain, ShiftAction } from "./assets";
import { BitcoinUTXO, createBTCTestnetAddress, getBTCTestnetUTXOs } from "./blockchain/btc";
import { createZECTestnetAddress, getZECTestnetUTXOs, ZcashUTXO } from "./blockchain/zec";

export type UTXO = { chain: Chain.Bitcoin, utxo: BitcoinUTXO } | { chain: Chain.ZCash, utxo: ZcashUTXO };

// 32-byte zero value
export const NULL32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface Arg {
    name: string;
    type: string;
    // tslint:disable-next-line: no-any
    value: any;
}

export type Payload = Arg[];

const unzip = (zip: Arg[]) => [zip.map(param => param.type), zip.map(param => param.value)];

// tslint:disable-next-line: no-any
export const generatePHash = (...zip: Arg[] | [Arg[]]): string => {
    // You can annotate values passed in to soliditySha3.
    // Example: { type: "address", value: srcToken }

    // Check if they called as hashPayload([...]) instead of hashPayload(...)
    const args = Array.isArray(zip) ? zip[0] as any as Arg[] : zip; // tslint:disable-line: no-any

    // If the payload is empty, use 0x0
    if (args.length === 0) {
        return NULL32;
    }

    const [types, values] = unzip(args);

    // tslint:disable-next-line: no-any
    return keccak256(rawEncode(types, values) as any as string); // sha3 can accept a Buffer
};

// TODO: Remove hard-coded address!
// TODO: Strip 0x
export const ZBTC_ADDRESS = "0x2341D423440892081516b49e42Fa93aF5280c5f5";

export const generateHash = (_to: string, _shiftAction: ShiftAction, amount: number | string, _payload: Payload): string => {
    // TODO: Nonce should be passed in
    const nonce = crypto.Random.getRandomBuffer(32);
    // const nonce = Buffer.from("74e5de9c04818622e2d1a73bf80a4cbdc65a4d08978aed53121c65b9629e1c73", "hex");

    const token = ZBTC_ADDRESS; // actionToDetails(_shiftAction).asset;
    const pHash = generatePHash(_payload);

    const hash = rawEncode(
        ["address", "address", "uint256", "bytes32", "bytes32"],
        [token, _to, amount, nonce, pHash],
    );

    // tslint:disable-next-line: no-any
    return keccak256(hash as any as string);
};

// Generates the gateway address
export const generateAddress = (_shiftAction: ShiftAction, hash: string): string => {

    const chain = actionToDetails(_shiftAction).from;
    switch (chain) {
        case Chain.Bitcoin:
            return createBTCTestnetAddress(hash);
        case Chain.ZCash:
            return createZECTestnetAddress(hash);
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
