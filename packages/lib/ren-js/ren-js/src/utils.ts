import BN from "bn.js";
import { rawEncode } from "ethereumjs-abi";
import { keccak256 } from "ethereumjs-util";

import { actionToDetails, Chain, ShiftAction } from "./assets";
import { BitcoinUTXO, createBTCTestnetAddress, getBTCTestnetUTXOs } from "./blockchain/btc";
import { createZECTestnetAddress, getZECTestnetUTXOs, ZcashUTXO } from "./blockchain/zec";
import { Ox, ShiftedInResponse, strip0x } from "./index";

export type UTXO = { chain: Chain.Bitcoin, utxo: BitcoinUTXO } | { chain: Chain.ZCash, utxo: ZcashUTXO };

// 32-byte zero value
export const NULL32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface Arg {
    name?: string;
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
    return Ox(keccak256(rawEncode(types, values))); // sha3 can accept a Buffer
};

// TODO: Remove hard-coded address!
// TODO: Strip 0x
export const ZBTC_ADDRESS = "0xef44c39102Ab3479F271e2fb3F27dB56D13b7a42";

export const generateHash = (_payload: Payload, amount: number | string, _to: string, _shiftAction: ShiftAction, nonce: string): string => {
    const token = ZBTC_ADDRESS; // actionToDetails(_shiftAction).asset;
    const pHash = generatePHash(_payload);

    const hash = rawEncode(
        ["bytes32", "uint256", "address", "address", "bytes32"],
        [Ox(pHash), amount, Ox(token), Ox(_to), Ox(nonce)],
    );

    // tslint:disable-next-line: no-any
    return Ox(keccak256(hash));
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

const secp256k1n = new BN("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", "hex");
export const fixSignature = (response: ShiftedInResponse): string => {
    const r = response.r;
    let s = new BN(strip0x(response.s), "hex");
    let v = ((parseInt(response.v || "0", 10) + 27) || 27);

    console.log(`Original signature: ${Ox(`${strip0x(r)}${strip0x(response.s)}${v.toString(16)}`)}`);

    if (s.gt(secp256k1n.div(new BN(2)))) {
        // Take s = -s % secp256k1n
        s = secp256k1n.sub(new BN(s));
        // Switch v
        v = v === 27 ? 28 : 27;
    }

    const sString = strip0x(s.toArrayLike(Buffer, "be", 32).toString("hex"));

    const signatureBytes = Ox(`${strip0x(r)}${sString}${v.toString(16)}`);
    console.log(`Fixed signature: ${signatureBytes}`);
    return signatureBytes;
};
