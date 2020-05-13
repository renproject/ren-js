import { RenNetworkDetails } from "@renproject/contracts";
import {
    Asset, BurnAndReleaseParams, Chain, EthArgs, LockAndMintParams, RenContract, RenTokens,
    UnmarshalledMintTx, UTXOIndex,
} from "@renproject/interfaces";
import BN from "bn.js";
import { ecrecover, keccak256, pubToAddress } from "ethereumjs-util";
import Web3 from "web3";
import { sha3 } from "web3-utils";

import { NULL, Ox, randomBytes, strip0x, toBase64, unzip } from "./common";
import { rawEncode } from "./ethereumUtils";

// export const generateNHash = (tx: Tx): string => {
//     const encoded = rawEncode(
//         ["bytes32", "bytes32"],
//         [Ox(tx.hash), Ox(tx.args.n)],
//     );

//     return Ox(keccak256(encoded));
// };

/**
 * Hash the payloads associated with a RenVM cross-chain transaction.
 *
 * @param zip An array (or spread) of parameters with with types defined.
 */
export const generatePHash = (...zip: EthArgs | [EthArgs]): string => {
    // Check if they called as hashPayload([...]) instead of hashPayload(...)
    const args = Array.isArray(zip) ? zip[0] as any as EthArgs : zip; // tslint:disable-line: no-any

    // // If the payload is empty, use 0x0
    // if (args.length === 0) {
    //     return NULL(32);
    // }

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

/**
 * parseRenContract splits a RenVM contract (e.g. `BTC0Eth2Btc`) into the asset
 * (`BTC`), the origin chain (`Eth`) and the target chain (`Btc`).
 */
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

export const getTokenName = (tokenOrContract: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")): RenTokens => {
    switch (tokenOrContract) {
        case RenTokens.BTC: case RenTokens.ZEC: case RenTokens.BCH: return tokenOrContract as RenTokens;
        case Asset.BTC: case "BTC": return RenTokens.BTC;
        case Asset.ZEC: case "ZEC": return RenTokens.ZEC;
        case Asset.BCH: case "BCH": return RenTokens.BCH;
        case Asset.ETH: throw new Error(`Unexpected token ${tokenOrContract}`);
        default:
            return getTokenName(parseRenContract(tokenOrContract).asset);
    }
};

export const syncGetTokenAddress = (renContract: RenContract, network: RenNetworkDetails): string => {
    switch (parseRenContract(renContract).asset) {
        case Asset.BTC:
            return network.addresses.gateways.RenBTC._address;
        case Asset.ZEC:
            return network.addresses.gateways.RenZEC._address;
        case Asset.BCH:
            return network.addresses.gateways.RenBCH._address;
        default:
            throw new Error(`Invalid Ren Contract ${renContract}`);
    }
};

export const generateGHash = (payload: EthArgs, /* amount: number | string, */ to: string, renContract: RenContract, nonce: string, network: RenNetworkDetails): string => {
    const token = syncGetTokenAddress(renContract, network);
    const pHash = generatePHash(payload);

    const encoded = rawEncode(
        ["bytes32", /*"uint256",*/ "address", "address", "bytes32"],
        [Ox(pHash), /*amount,*/ Ox(token), Ox(to), Ox(nonce)],
    );

    return Ox(keccak256(encoded));
};

export const generateSighash = (pHash: string, amount: number | string, to: string, renContract: RenContract, nonceHash: string, network: RenNetworkDetails): string => {
    const token = syncGetTokenAddress(renContract, network);

    const encoded = rawEncode(
        ["bytes32", "uint256", "address", "address", "bytes32"],
        [Ox(pHash), amount, token, to, nonceHash],
    );

    return Ox(keccak256(encoded));
};

export const txHashToBase64 = (txHash: Buffer | string) => {
    if (Buffer.isBuffer(txHash)) {
        return txHash.toString("base64");
    }

    // Check if it's hex-encoded
    if (txHash.match(/^(0x)?[0-9a-fA-Z]{64}$/)) {
        return Buffer.from(strip0x(txHash), "hex").toString("base64");
    }
    return txHash;
};

export const generateMintTxHash = (renContract: RenContract, encodedID: string, utxo: UTXOIndex) => {
    return txHashToBase64(keccak256(`txHash_${renContract}_${encodedID}_${toBase64(utxo.txHash)}_${utxo.vOut}`));
};

export const generateBurnTxHash = (renContract: RenContract, encodedID: string) => {
    return txHashToBase64(keccak256(`txHash_${renContract}_${encodedID}`));
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
export const fixSignature = (response: UnmarshalledMintTx, network: RenNetworkDetails): Signature => {
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

    // TODO: Fix code below to check against proper mintAuthority

    // // Currently, the wrong `v` value may be returned from RenVM. We recover the
    // // address to see if we need to switch `v`. This can be removed once RenVM
    // // has been updated.
    // const recovered = {
    //     [v]: pubToAddress(ecrecover(
    //         Buffer.from(strip0x(response.autogen.sighash), "hex"),
    //         v,
    //         Buffer.from(strip0x(r), "hex"),
    //         s.toArrayLike(Buffer, "be", 32),
    //     )),

    //     [switchV(v)]: pubToAddress(ecrecover(
    //         Buffer.from(strip0x(response.autogen.sighash), "hex"),
    //         switchV(v),
    //         Buffer.from(strip0x(r), "hex"),
    //         s.toArrayLike(Buffer, "be", 32),
    //     )),
    // };

    // const expected = Buffer.from(strip0x(.network.renVM.mintAuthority), "hex");
    // if (recovered[v].equals(expected)) {
    //     // Do nothing
    // } else if (recovered[switchV(v)].equals(expected)) {
    //     // tslint:disable-next-line: no-console
    //     console.info("[info][ren-js] switching v value");
    //     v = switchV(v);
    // } else {
    //     throw new Error(`Invalid signature - unable to recover mint authority from signature (Expected ${Ox(expected)}, got ${Ox(recovered[v])})`);
    // }

    const signature: Signature = {
        r,
        s: strip0x(s.toArrayLike(Buffer, "be", 32).toString("hex")),
        v,
    };

    return signature;
};

export const getTokenAddress = async (network: RenNetworkDetails, web3: Web3, tokenOrContract: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => {
    try {
        const registry = new web3.eth.Contract(network.addresses.gateways.GatewayRegistry.abi, network.addresses.gateways.GatewayRegistry.address);
        return await registry.methods.getTokenBySymbol(getTokenName(tokenOrContract)).call();
    } catch (error) {
        (error || {}).error = `Error looking up ${tokenOrContract} token address: ${error.message}`;
        throw error;
    }
};

export const getGatewayAddress = async (network: RenNetworkDetails, web3: Web3, tokenOrContract: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")) => {
    try {
        const registry = new web3.eth.Contract(network.addresses.gateways.GatewayRegistry.abi, network.addresses.gateways.GatewayRegistry.address);
        return await registry.methods.getGatewayBySymbol(getTokenName(tokenOrContract)).call();
    } catch (error) {
        (error || {}).error = `Error looking up ${tokenOrContract}Gateway address: ${error.message}`;
        throw error;
    }
};

export const findTransactionBySigHash = async (network: RenNetworkDetails, web3: Web3, tokenOrContract: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH"), sigHash: string): Promise<string | undefined> => {
    try {
        const gatewayAddress = await getGatewayAddress(network, web3, tokenOrContract);
        const gatewayContract = new web3.eth.Contract(
            network.addresses.gateways.BTCGateway.abi,
            gatewayAddress,
        );
        // We can skip the `status` check and call `getPastLogs` directly - for now both are called in case
        // the contract
        const status = await gatewayContract.methods.status(sigHash).call();
        if (status) {
            const recentRegistrationEvents = await web3.eth.getPastLogs({
                address: gatewayAddress,
                fromBlock: "1",
                toBlock: "latest",
                // topics: [sha3("LogDarknodeRegistered(address,uint256)"), "0x000000000000000000000000" +
                // address.slice(2), null, null] as any,
                topics: [sha3("LogMint(address,uint256,uint256,bytes32)"), null, null, sigHash] as string[],
            });
            if (!recentRegistrationEvents.length) {
                throw new Error(`Mint has been submitted but no log was found.`);
            }
            const log = recentRegistrationEvents[0];
            return log.transactionHash;
        }
    } catch (error) {
        // tslint:disable-next-line: no-console
        console.error(error);
        // Continue with transaction
    }
    return;
};

/**
 * Returns a random 32 byte hex string (prefixed with '0x').
 */
export const randomNonce = () => randomBytes(32);

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

export const resolveSendTo = <T extends LockAndMintParams | BurnAndReleaseParams>({ isMint }: { isMint: boolean }) => (params: T): typeof params => {
    params.sendToken = isMint ? resolveInToken(params.sendToken) : resolveOutToken(params.sendToken);
    return params;
};
