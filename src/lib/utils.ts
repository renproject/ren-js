import {
    Asset, Chain, EthArgs, NULL, Ox, RenContract, ShiftedToken, strip0x, UnmarshalledMintTx, value,
} from "@renproject/ren-js-common";
import BigNumber from "bignumber.js";
import { crypto } from "bitcore-lib";
import BN from "bn.js";
import { ecrecover, keccak256, pubToAddress } from "ethereumjs-util";
import Web3 from "web3";
import { TransactionConfig } from "web3-core";
import { AbiCoder } from "web3-eth-abi";
import { keccak256 as web3Keccak256 } from "web3-utils";

import { createBCHAddress, getBitcoinCashUTXOs } from "../blockchain/bch";
import { createBTCAddress, getBitcoinUTXOs } from "../blockchain/btc";
import { createZECAddress, getZcashUTXOs } from "../blockchain/zec";
import { bchUtils, btcUtils, parseRenContract, zecUtils } from "../types/assets";
import { NetworkDetails } from "../types/networks";

export interface UTXODetails {
    readonly txid: string; // hex string without 0x prefix
    readonly value: number; // satoshis
    readonly script_hex?: string; // hex string without 0x prefix
    readonly output_no: number;
    readonly confirmations: number;
}

export interface UTXOInput {
    readonly txid: string; // hex string without 0x prefix
    readonly output_no: number;
}

export type UTXO = { chain: Chain.Bitcoin, utxo: UTXODetails } | { chain: Chain.Zcash, utxo: UTXODetails } | { chain: Chain.BitcoinCash, utxo: UTXODetails };

// Pad a hex string if necessary so that its length is even
// export const evenHex = (hex: string) => hex.length % 2 ? `0${strip0x(hex)}` : hex;

const unzip = (zip: EthArgs) => [zip.map(param => param.type), zip.map(param => param.value)];

// tslint:disable-next-line:no-any
const rawEncode = (types: Array<string | {}>, parameters: any[]) => (new AbiCoder()).encodeParameters(types, parameters);

// tslint:disable-next-line: no-any
export const generatePHash = (...zip: EthArgs | [EthArgs]): string => {
    // You can annotate values passed in to soliditySha3.
    // Example: { type: "address", value: srcToken }

    // Check if they called as hashPayload([...]) instead of hashPayload(...)
    const args = Array.isArray(zip) ? zip[0] as any as EthArgs : zip; // tslint:disable-line: no-any

    // If the payload is empty, use 0x0
    if (args.length === 0) {
        return NULL(32);
    }

    const [types, values] = unzip(args);

    return Ox(keccak256(rawEncode(types, values))); // sha3 can accept a Buffer
};

export const getTokenName = (tokenOrContract: ShiftedToken | RenContract | Asset | ("BTC" | "ZEC" | "BCH")): ShiftedToken => {
    switch (tokenOrContract) {
        case ShiftedToken.zBTC: case ShiftedToken.zZEC: case ShiftedToken.zBCH: return tokenOrContract;
        case Asset.BTC: case "BTC": return ShiftedToken.zBTC;
        case Asset.ZEC: case "ZEC": return ShiftedToken.zZEC;
        case Asset.BCH: case "BCH": return ShiftedToken.zBCH;
        case Asset.ETH: throw new Error(`Unexpected token ${tokenOrContract}`);
        default:
            return getTokenName(parseRenContract(tokenOrContract).asset);
    }
};

export const syncGetTokenAddress = (renContract: RenContract, network: NetworkDetails): string => {
    switch (parseRenContract(renContract).asset) {
        case Asset.BTC:
            return network.contracts.addresses.shifter.zBTC._address;
        case Asset.ZEC:
            return network.contracts.addresses.shifter.zZEC._address;
        case Asset.BCH:
            return network.contracts.addresses.shifter.zBCH._address;
        default:
            throw new Error(`Invalid Ren Contract ${renContract}`);
    }
};

export const generateGHash = (payload: EthArgs, /* amount: number | string, */ to: string, renContract: RenContract, nonce: string, network: NetworkDetails): string => {
    const token = syncGetTokenAddress(renContract, network);
    const pHash = generatePHash(payload);

    const encoded = rawEncode(
        ["bytes32", /*"uint256",*/ "address", "address", "bytes32"],
        [Ox(pHash), /*amount,*/ Ox(token), Ox(to), Ox(nonce)],
    );

    return Ox(keccak256(encoded));
};

export const generateSighash = (pHash: string, amount: number | string, to: string, renContract: RenContract, nonceHash: string, network: NetworkDetails): string => {
    const token = syncGetTokenAddress(renContract, network);

    const encoded = rawEncode(
        ["bytes32", "uint256", "address", "address", "bytes32"],
        [Ox(pHash), amount, token, to, nonceHash],
    );

    return Ox(keccak256(encoded));
};

export const toBase64 = (input: string | Buffer) =>
    (Buffer.isBuffer(input) ? input : Buffer.from(strip0x(input), "hex")).toString("base64");

export const renTxHashToBase64 = (renTxHash: Buffer | string) => {
    if (Buffer.isBuffer(renTxHash)) {
        return renTxHash.toString("base64");
    }

    // Check if it's hex-encoded
    if (renTxHash.match(/^(0x)?[0-9a-fA-Z]{64}$/)) {
        return Buffer.from(strip0x(renTxHash), "hex").toString("base64");
    }
    return renTxHash;
};

export const generateShiftInTxHash = (renContract: RenContract, encodedID: string, utxo: UTXOInput) => {
    return renTxHashToBase64(keccak256(`txHash_${renContract}_${encodedID}_${toBase64(utxo.txid)}_${utxo.output_no}`));
};

export const generateShiftOutTxHash = (renContract: RenContract, encodedID: string) => {
    return renTxHashToBase64(keccak256(`txHash_${renContract}_${encodedID}`));
};

// export const generateNHash = (tx: Tx): string => {
//     const encoded = rawEncode(
//         ["bytes32", "bytes32"],
//         [Ox(tx.hash), Ox(tx.args.n)],
//     );

//     return Ox(keccak256(encoded));
// };

// Generates the gateway address
export const generateAddress = (renContract: RenContract, gHash: string, network: NetworkDetails): string => {
    const chain = parseRenContract(renContract).from;
    switch (chain) {
        case Chain.Bitcoin:
            return createBTCAddress(network, gHash);
        case Chain.Zcash:
            return createZECAddress(network, gHash);
        case Chain.BitcoinCash:
            return createBCHAddress(network, gHash);
        default:
            throw new Error(`Unable to generate deposit address for chain ${chain}`);
    }
};

// Retrieves unspent deposits at the provided address
export const retrieveDeposits = async (_network: NetworkDetails, renContract: RenContract, depositAddress: string, confirmations = 0): Promise<UTXO[]> => {
    const chain = parseRenContract(renContract).from;
    switch (chain) {
        case Chain.Bitcoin:
            return (await getBitcoinUTXOs(_network)(depositAddress, confirmations)).map((utxo: UTXODetails) => ({ chain: Chain.Bitcoin as Chain.Bitcoin, utxo }));
        case Chain.Zcash:
            return (await getZcashUTXOs(_network)(depositAddress, confirmations)).map((utxo: UTXODetails) => ({ chain: Chain.Zcash as Chain.Zcash, utxo }));
        case Chain.BitcoinCash:
            // tslint:disable-next-line: no-unnecessary-type-assertion
            return (await getBitcoinCashUTXOs(_network)(depositAddress, confirmations)).map((utxo: UTXODetails) => ({ chain: Chain.BitcoinCash as Chain.BitcoinCash, utxo }));
        default:
            throw new Error(`Unable to retrieve deposits for chain ${chain}`);
    }
};

export const SECONDS = 1000;
// tslint:disable-next-line: no-string-based-set-timeout
export const sleep = async (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

interface Signature { r: string; s: string; v: number; }

export const signatureToString = <T extends Signature>(sig: T): string => Ox(`${strip0x(sig.r)}${sig.s}${sig.v.toString(16)}`);

const switchV = (v: number) => v === 27 ? 28 : 27; // 28 - (v - 27);

const secp256k1n = new BN("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", "hex");
export const fixSignature = (response: UnmarshalledMintTx, network: NetworkDetails): Signature => {
    if (!response.out) {
        throw new Error(`Expected transaction response to have signature`);
    }

    const expectedSighash = generateSighash(response.autogen.phash, response.autogen.amount, response.in.to, response.to, response.autogen.nhash, network);
    if (Ox(response.autogen.sighash) !== Ox(expectedSighash)) {
        // tslint:disable-next-line: no-console
        console.warn(`Warning: RenVM returned invalid signature hash. Expected ${expectedSighash} but for ${response.autogen.sighash}`);
    }

    const r = response.out.r;
    let s = new BN(strip0x(response.out.s), "hex");
    let v = ((parseInt(response.out.v || "0", 10) + 27) || 27);

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
            Buffer.from(strip0x(response.autogen.sighash), "hex"),
            v,
            Buffer.from(strip0x(r), "hex"),
            s.toArrayLike(Buffer, "be", 32),
        )),

        [switchV(v)]: pubToAddress(ecrecover(
            Buffer.from(strip0x(response.autogen.sighash), "hex"),
            switchV(v),
            Buffer.from(strip0x(r), "hex"),
            s.toArrayLike(Buffer, "be", 32),
        )),
    };

    const expected = Buffer.from(strip0x(network.contracts.renVM.mintAuthority), "hex");
    if (recovered[v].equals(expected)) {
        // Do nothing
    } else if (recovered[switchV(v)].equals(expected)) {
        // tslint:disable-next-line: no-console
        console.info("[info][ren-js] switching v value");
        v = switchV(v);
    } else {
        throw new Error(`Invalid signature - unable to recover mint authority from signature (Expected ${Ox(expected)}, got ${Ox(recovered[v])})`);
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
        return (error && error.message && (
            error.message.match(/Invalid block number/) ||
            error.message.match(/Timeout exceeded during the transaction confirmation process./)
        ));
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
                throw new Error("Must provide a 'from' address in the transaction config.");
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
    for (let i = 0; retries === -1 || i < retries; i++) {
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
                returnError = error;
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
 *
 * @/param nonce The nonce of the transaction, to detect if it has been
 *        overwritten.
 */
export const waitForReceipt = async (web3: Web3, transactionHash: string/*, nonce?: number*/) => {

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

export const toBigNumber = (n: BigNumber | { toString(): string }) => BigNumber.isBigNumber(n) ? new BigNumber(n.toFixed()) : new BigNumber(n.toString());

export const getTokenAddress = async (network: NetworkDetails, web3: Web3, tokenOrContract: ShiftedToken | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => {
    try {
        const shifterRegistry = new web3.eth.Contract(network.contracts.addresses.shifter.ShifterRegistry.abi, network.contracts.addresses.shifter.ShifterRegistry.address);
        return await shifterRegistry.methods.getTokenBySymbol(getTokenName(tokenOrContract)).call();
    } catch (error) {
        (error || {}).error = `Error looking up ${tokenOrContract} token address: ${error.message}`;
        throw error;
    }
};

export const getShifterAddress = async (network: NetworkDetails, web3: Web3, tokenOrContract: ShiftedToken | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => {
    try {
        const shifterRegistry = new web3.eth.Contract(network.contracts.addresses.shifter.ShifterRegistry.abi, network.contracts.addresses.shifter.ShifterRegistry.address);
        return await shifterRegistry.methods.getShifterBySymbol(getTokenName(tokenOrContract)).call();
    } catch (error) {
        (error || {}).error = `Error looking up ${tokenOrContract} shifter address: ${error.message}`;
        throw error;
    }
};

export const utils = {
    Ox,
    strip0x,
    randomNonce,
    value,

    // Bitcoin
    BTC: btcUtils,
    btc: btcUtils,

    // Zcash
    ZEC: zecUtils,
    zec: zecUtils,

    // Bitcoin Cash
    BCH: bchUtils,
    bch: bchUtils,
};

export const assert = (assertion: boolean, sentence?: string): assertion is true => {
    if (!assertion) {
        throw new Error(`Failed assertion${sentence ? `: ${sentence}` : ""}`);
    }
    return true;
};
