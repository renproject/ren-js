import { crypto } from "bitcore-lib";
import BN from "bn.js";
import { ecrecover, keccak256, pubToAddress } from "ethereumjs-util";
import Web3 from "web3";
import { TransactionConfig } from "web3-core";
import { AbiCoder } from "web3-eth-abi";
import { keccak256 as web3Keccak256 } from "web3-utils";

import { BCashUTXO, createBCHAddress, getBCashUTXOs } from "../blockchain/bch";
import { BitcoinUTXO, createBTCAddress, getBitcoinUTXOs } from "../blockchain/btc";
import { Ox, strip0x } from "../blockchain/common";
import { createZECAddress, getZcashUTXOs, ZcashUTXO } from "../blockchain/zec";
import { Args } from "../renVM/jsonRPC";
import { Tx } from "../renVM/transaction";
import { actionToDetails, Asset, Chain, Token } from "../types/assets";
import { NetworkDetails } from "../types/networks";

export type UTXO = { chain: Chain.Bitcoin, utxo: BitcoinUTXO } | { chain: Chain.Zcash, utxo: ZcashUTXO } | { chain: Chain.BCash, utxo: BCashUTXO };

// 32-byte zero value
export const NULL32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const unzip = (zip: Args) => [zip.map(param => param.type), zip.map(param => param.value)];

// tslint:disable-next-line:no-any
const rawEncode = (types: Array<string | {}>, parameters: any[]) => (new AbiCoder()).encodeParameters(types, parameters);

// tslint:disable-next-line: no-any
export const generatePHash = (...zip: Args | [Args]): string => {
    // You can annotate values passed in to soliditySha3.
    // Example: { type: "address", value: srcToken }

    // Check if they called as hashPayload([...]) instead of hashPayload(...)
    const args = Array.isArray(zip) ? zip[0] as any as Args : zip; // tslint:disable-line: no-any

    // If the payload is empty, use 0x0
    if (args.length === 0) {
        return NULL32;
    }

    const [types, values] = unzip(args);

    return Ox(keccak256(rawEncode(types, values))); // sha3 can accept a Buffer
};

export const getTokenAddress = (action: Token, network: NetworkDetails): string => {
    switch (actionToDetails(action).asset) {
        case Asset.BTC:
            return network.contracts.addresses.shifter.zBTC._address;
        case Asset.ZEC:
            return network.contracts.addresses.shifter.zZEC._address;
        case Asset.BCH:
            return network.contracts.addresses.shifter.zBCH._address;
        default:
            throw new Error(`Invalid action ${action}`);
    }
};

export const generateGHash = (_payload: Args, amount: number | string, _to: string, _shiftAction: Token, nonce: string, network: NetworkDetails): string => {
    const token = getTokenAddress(_shiftAction, network);
    const pHash = generatePHash(_payload);

    const encoded = rawEncode(
        ["bytes32", "uint256", "address", "address", "bytes32"],
        [Ox(pHash), amount, Ox(token), Ox(_to), Ox(nonce)],
    );

    return Ox(keccak256(encoded));
};

export const generateNHash = (tx: Tx): string => {
    const encoded = rawEncode(
        ["bytes32", "bytes32"],
        [Ox(tx.hash), Ox(tx.args.n)],
    );

    return Ox(keccak256(encoded));
};

// Generates the gateway address
export const generateAddress = (_shiftAction: Token, gHash: string, network: NetworkDetails): string => {
    const chain = actionToDetails(_shiftAction).from;
    switch (chain) {
        case Chain.Bitcoin:
            return createBTCAddress(network, gHash);
        case Chain.Zcash:
            return createZECAddress(network, gHash);
        case Chain.BCash:
            return createBCHAddress(network, gHash);
        default:
            throw new Error(`Unable to generate deposit address for chain ${chain}`);
    }
};

// Retrieves unspent deposits at the provided address
export const retrieveDeposits = async (_network: NetworkDetails, _shiftAction: Token, _depositAddress: string, confirmations = 0, endpoint = 0): Promise<UTXO[]> => {
    const chain = actionToDetails(_shiftAction).from;
    switch (chain) {
        case Chain.Bitcoin:
            return (await getBitcoinUTXOs(_network)(_depositAddress, confirmations, endpoint)).map((utxo: BitcoinUTXO) => ({ chain: Chain.Bitcoin as Chain.Bitcoin, utxo }));
        case Chain.Zcash:
            return (await getZcashUTXOs(_network)(_depositAddress, confirmations, endpoint)).map((utxo: ZcashUTXO) => ({ chain: Chain.Zcash as Chain.Zcash, utxo }));
        case Chain.BCash:
            return (await getBCashUTXOs(_network)(_depositAddress, confirmations, endpoint)).map((utxo: BCashUTXO) => ({ chain: Chain.BCash as Chain.BCash, utxo }));
        default:
            throw new Error(`Unable to retrieve deposits for chain ${chain}`);
    }
};

export const SECONDS = 1000;
// tslint:disable-next-line: no-string-based-set-timeout
export const sleep = async (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export interface Signature { r: string; s: string; v: number; }

export const signatureToString = <T extends Signature>(sig: T): string => Ox(`${strip0x(sig.r)}${sig.s}${sig.v.toString(16)}`);

const switchV = (v: number) => v === 27 ? 28 : 27; // 28 - (v - 27);

const secp256k1n = new BN("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", "hex");
export const fixSignature = (response: Tx, network: NetworkDetails): Signature => {

    const r = response.signature.r;
    let s = new BN(strip0x(response.signature.s), "hex");
    let v = ((parseInt(response.signature.v || "0", 10) + 27) || 27);

    // For a given key, there are two valid signatures for each signed message.
    // We always take the one with the lower `s`.
    if (s.gt(secp256k1n.div(new BN(2)))) {
        // Take s = -s % secp256k1n
        s = secp256k1n.sub(new BN(s));
        // Switch v
        v = switchV(v);
    }

    // Currently, the wrong `v` value may be returned from RenVM. We recover the
    // address to see if we need to switch `v`. This can be removed once RenVM
    // has been updated.
    const recovered = {
        [v]: pubToAddress(ecrecover(
            Buffer.from(strip0x(response.args.hash), "hex"),
            v,
            Buffer.from(strip0x(r), "hex"),
            s.toArrayLike(Buffer, "be", 32),
        )),

        [switchV(v)]: pubToAddress(ecrecover(
            Buffer.from(strip0x(response.args.hash), "hex"),
            switchV(v),
            Buffer.from(strip0x(r), "hex"),
            s.toArrayLike(Buffer, "be", 32),
        )),
    };

    const expected = Buffer.from(strip0x(network.contracts.renVM.mintAuthority), "hex");
    if (recovered[v].equals(expected)) {
        // Do nothing
    } else if (recovered[switchV(v)].equals(expected)) {
        console.warn("Switching v value");
        v = switchV(v);
    } else {
        throw new Error("Invalid signature. Unable to recover mint authority from signature.");
    }

    const signature: Signature = {
        r,
        s: strip0x(s.toArrayLike(Buffer, "be", 32).toString("hex")),
        v,
    };

    return signature;
};

// Currently should equal 0x2275318eaeb892d338c6737eebf5f31747c1eab22b63ccbc00cd93d4e785c116
export const BURN_TOPIC = web3Keccak256("LogShiftOut(bytes,uint256,uint256,bytes)");

// tslint:disable-next-line: no-any
export const ignoreError = (error: any): boolean => {
    try {
        return (error && error.message && error.message.match(/Invalid block number/));
    } catch (error) {
        return false;
    }
};

export const withDefaultAccount = async (web3: Web3, config: TransactionConfig): Promise<TransactionConfig> => {
    if (!config.from) {
        if (web3.eth.defaultAccount) {
            config.from = web3.eth.defaultAccount;
        } else {
            const accounts = await web3.eth.getAccounts();
            if (accounts.length === 0) {
                throw new Error("Must provide a 'from' address in the transaction config");
            }
            config.from = accounts[0];
        }
    }
    return config;
};

// tslint:disable-next-line: no-any
export const extractError = (error: any): string => {
    if (typeof error === "object") {
        if (error.response) { return extractError(error.response); }
        if (error.data) { return extractError(error.data); }
        if (error.error) { return extractError(error.error); }
        if (error.message) { return extractError(error.message); }
        if (error.statusText) { return extractError(error.statusText); }
        try {
            return JSON.stringify(error);
        } catch (error) {
            // Ignore JSON error
        }
    }
    return String(error);
};

export const retryNTimes = async <T>(fnCall: () => Promise<T>, retries: number) => {
    let returnError;
    // tslint:disable-next-line: no-constant-condition
    for (let i = 0; i < retries; i++) {
        // if (i > 0) {
        //     console.debug(`Retrying...`);
        // }
        try {
            return await fnCall();
        } catch (error) {
            if (String(error).match(/timeout of .* exceeded/)) {
                returnError = error;
            } else {
                const errorMessage = extractError(error);
                if (errorMessage) {
                    error.message += ` (${errorMessage})`;
                }
                throw error;
            }
        }
    }
    throw returnError;
};

/**
 * Returns a random 32 byte hex string.
 */
export const randomNonce = () => Ox(crypto.Random.getRandomBuffer(32));

/**
 * Waits for the receipt of a transaction to be available, retrying every 3
 * seconds until it is.
 *
 * @param web3 A web3 instance.
 * @param transactionHash The hash of the transaction being read.
 * @param nonce The nonce of the transaction, to detect if it has been
 *        overwritten.
 */
export const waitForReceipt = async (web3: Web3, transactionHash: string, nonce?: number) => {

    // TODO: Handle transactions being overwritten.

    // Wait for confirmation
    let receipt;
    while (!receipt || !receipt.blockHash) {
        receipt = await web3.eth.getTransactionReceipt(transactionHash);
        if (receipt && receipt.blockHash) {
            break;
        }
        await sleep(3 * 1000);
    }

    // Status might be undefined - so check against `false` explicitly.
    if (receipt.status === false) {
        throw new Error(`Transaction was reverted. { "transactionHash": "${transactionHash}" }`);
    }

    return receipt;
};
