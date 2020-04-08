import {
    createBCHAddress, createBTCAddress, createZECAddress, getBitcoinCashConfirmations,
    getBitcoinCashUTXOs, getBitcoinConfirmations, getBitcoinUTXOs, getZcashConfirmations,
    getZcashUTXOs,
} from "@renproject/chains";
import {
    Asset, BurnAndReleaseParams, Chain, EthArgs, LockAndMintParams, NULL, Ox, RenContract,
    ShiftedToken, strip0x, Tx, UnmarshalledMintTx, UTXO, UTXODetails, UTXOInput, value,
} from "@renproject/interfaces";
import BigNumber from "bignumber.js";
import BN from "bn.js";
import { ecrecover, keccak256, pubToAddress } from "ethereumjs-util";
import Web3 from "web3";

import { bchUtils, btcUtils, zecUtils } from "./assets";
import { rawEncode } from "./ethereumUtils";
import { NetworkDetails } from "./types/networks";
import { randomBytes, toBase64, unzip } from "./utils";

// export const generateNHash = (tx: Tx): string => {
//     const encoded = rawEncode(
//         ["bytes32", "bytes32"],
//         [Ox(tx.hash), Ox(tx.args.n)],
//     );

//     return Ox(keccak256(encoded));
// };

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

interface RenContractDetails {
    asset: Asset;
    from: Chain;
    to: Chain;
}

const renContractRegex = /^(.*)0(.*)2(.*)$/;
const defaultMatch = [undefined, undefined, undefined, undefined];

// parseRenContract splits an action (e.g. `BTC0Eth2Btc`) into the asset
// (`BTC`), the from chain (`Eth`)
export const parseRenContract = (renContract: RenContract): RenContractDetails => {
    // re.exec("BTC0Eth2Btc") => ['BTC0Eth2Btc', 'BTC', 'Eth', 'Btc']
    const [, asset, from, to] = renContractRegex.exec(renContract) || defaultMatch;
    if (!asset || !from || !to) {
        throw new Error(`Invalid Ren Contract "${renContract}"`);
    }

    return {
        asset: asset as Asset,
        from: from as Chain,
        to: to as Chain
    };
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
            if (network.contracts.version === "0.0.3") {
                return network.contracts.addresses.shifter.zBTC._address;
            } else {
                return network.contracts.addresses.shifter.RenBTC._address;
            }
        case Asset.ZEC:
            if (network.contracts.version === "0.0.3") {
                return network.contracts.addresses.shifter.zZEC._address;
            } else {
                return network.contracts.addresses.shifter.RenZEC._address;
            }
        case Asset.BCH:
            if (network.contracts.version === "0.0.3") {
                return network.contracts.addresses.shifter.zBCH._address;
            } else {
                return network.contracts.addresses.shifter.RenBCH._address;
            }
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

export const getTokenAddress = async (network: NetworkDetails, web3: Web3, tokenOrContract: ShiftedToken | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => {
    try {
        if (network.contracts.version === "0.0.3") {
            const registry = new web3.eth.Contract(network.contracts.addresses.shifter.ShifterRegistry.abi, network.contracts.addresses.shifter.ShifterRegistry.address);
            return await registry.methods.getTokenBySymbol(getTokenName(tokenOrContract)).call();
        } else {
            const registry = new web3.eth.Contract(network.contracts.addresses.shifter.GatewayRegistry.abi, network.contracts.addresses.shifter.GatewayRegistry.address);
            return await registry.methods.getTokenBySymbol(getTokenName(tokenOrContract)).call();
        }
    } catch (error) {
        (error || {}).error = `Error looking up ${tokenOrContract} token address: ${error.message}`;
        throw error;
    }
};

export const getGatewayAddress = async (network: NetworkDetails, web3: Web3, tokenOrContract: ShiftedToken | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => {
    try {
        if (network.contracts.version === "0.0.3") {
            const registry = new web3.eth.Contract(network.contracts.addresses.shifter.ShifterRegistry.abi, network.contracts.addresses.shifter.ShifterRegistry.address);
            return await registry.methods.getShifterBySymbol(getTokenName(tokenOrContract)).call();
        } else {
            const registry = new web3.eth.Contract(network.contracts.addresses.shifter.GatewayRegistry.abi, network.contracts.addresses.shifter.GatewayRegistry.address);
            return await registry.methods.getGatewayBySymbol(getTokenName(tokenOrContract)).call();
        }
    } catch (error) {
        (error || {}).error = `Error looking up ${tokenOrContract} shifter address: ${error.message}`;
        throw error;
    }
};


// Generates the gateway address
export const generateAddress = (renContract: RenContract, gHash: string, network: NetworkDetails): string => {
    const chain = parseRenContract(renContract).from;
    const mpkh = network.contracts.renVM.mpkh;
    switch (chain) {
        case Chain.Bitcoin:
            return createBTCAddress(network.isTestnet, mpkh, gHash);
        case Chain.Zcash:
            return createZECAddress(network.isTestnet, mpkh, gHash);
        case Chain.BitcoinCash:
            return createBCHAddress(network.isTestnet, mpkh, gHash);
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

export const retrieveConfirmations = async (_network: NetworkDetails, transaction: Tx): Promise<number> => {
    const txid = transaction.chain === Chain.Ethereum ? 0 : transaction.utxo ? transaction.utxo.txid : transaction.hash;
    if (!txid) {
        return 0;
    }
    switch (transaction.chain) {
        case Chain.Bitcoin:
            return (await getBitcoinConfirmations(_network)(txid));
        case Chain.Zcash:
            return (await getZcashConfirmations(_network)(txid));
        case Chain.BitcoinCash:
            // tslint:disable-next-line: no-unnecessary-type-assertion
            return (await getBitcoinCashConfirmations(_network)(txid));
        default:
            throw new Error(`Unable to retrieve deposits for chain ${transaction.chain}`);
    }
};

/**
 * Returns a random 32 byte hex string (prefixed with '0x').
 */
export const randomNonce = () => randomBytes(32);

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

// TODO: Fetch from contract
export const DEFAULT_SHIFT_FEE = new BigNumber(10000);

export const resolveInToken = (sendToken: LockAndMintParams["sendToken"]): RenContract => {
    switch (sendToken) {
        case "BTC":
            return RenContract.Btc2Eth;
        case "BCH":
            return RenContract.Bch2Eth;
        case "ZEC":
            return RenContract.Zec2Eth;
        default:
            return sendToken;
    }
};

export const resolveOutToken = (sendToken: LockAndMintParams["sendToken"]): RenContract => {
    switch (sendToken) {
        case "BTC":
            return RenContract.Eth2Btc;
        case "BCH":
            return RenContract.Eth2Bch;
        case "ZEC":
            return RenContract.Eth2Zec;
        default:
            return sendToken;
    }
};

export const resolveSendTo = <T extends LockAndMintParams | BurnAndReleaseParams>({ shiftIn }: { shiftIn: boolean }) => (params: T): typeof params => {
    params.sendToken = shiftIn ? resolveInToken(params.sendToken) : resolveOutToken(params.sendToken);
    return params;
};
