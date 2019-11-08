import Axios from "axios";
import BigNumber from "bignumber.js";
import https from "https";

import { BCashUTXO } from "../blockchain/bch";
import { BitcoinUTXO } from "../blockchain/btc";
import { ZcashUTXO } from "../blockchain/zec";
import { retryNTimes } from "../lib/utils";
import { NetworkDetails } from "../types/networks";

type UTXO = BitcoinUTXO | ZcashUTXO | BCashUTXO;

// Convert values to correct unit
const fixValues = (utxos: UTXO[], decimals: number) => {
    return utxos.map(utxo => ({
        ...utxo,
        value: new BigNumber(utxo.value).multipliedBy(new BigNumber(10).exponentiatedBy(decimals)).toNumber(),
    }));
};

export const fetchFromChainSo = async (url: string) => {
    const response = await retryNTimes(
        () => Axios.get<{ data: { txs: Array<BitcoinUTXO | ZcashUTXO> } }>(url),
        5.
    );

    return fixValues(response.data.data.txs, 8);
};

export const fetchFromBlockstream = async (url: string, getHeight: string): Promise<UTXO[]> => {
    const response = await retryNTimes(
        () => Axios.get<Array<{
            status: {
                confirmed: boolean,
                block_height: number,
                block_hash: string,
                block_time: number,
            };
            txid: string;
            value: number;
            vout: number;
        }>>(url),
        5,
    );

    const heightResponse = await retryNTimes(
        () => Axios.get<string>(getHeight),
        5,
    );

    // tslint:disable-next-line: no-object-literal-type-assertion
    return response.data.map(utxo => ({
        txid: utxo.txid,
        value: utxo.value,
        // Placeholder
        script_hex: "76a914b0c08e3b7da084d7dbe9431e9e49fb61fb3b64d788ac",
        output_no: utxo.vout,
        confirmations: utxo.status.confirmed ? 1 + parseInt(heightResponse.data, 10) - utxo.status.block_height : 0,
    }));
};

export const fetchFromInsight = async (url: string): Promise<UTXO[]> => {
    const response = await retryNTimes(
        () => Axios.get<Array<{
            address: string;
            txid: string;
            vout: number;
            scriptPubKey: string;
            amount: number;
            satoshis: number;
            confirmations: number;
            ts: number;
        }>>(url, {
            // TTODO: Remove when certificate is fixed.
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        }),
        5,
    );

    return fixValues(response.data.map(utxo => ({
        txid: utxo.txid,
        value: utxo.amount,
        script_hex: utxo.scriptPubKey,
        output_no: utxo.vout,
        confirmations: utxo.confirmations,
    })), 8);
};

// export const fetchFromZechain = async (url: string): Promise<ZcashUTXO[]> => {
//     // Mainnet ZEC only!
//     const resp = await retryNTimes(
//         () => Axios.get<Array<{
//             address: string; // "t1eUHMR2k3NjZBuxmveSfee71otew7RFdwt"
//             txid: string; // "3b144316b919d01105378c0f4e3b1d3914c04d6b1ca009dae800295f1cfb35a8"
//             vout: number; // 0
//             scriptPubKey: string; // "76a914e1f180bffadc561719c64c76b2fa3efacf955e0088ac"
//             amount: number; // 0.11912954
//             satoshis: number; // 11912954
//             height: number; // 573459
//             confirmations: number; // 4
//         }>>(url),
//         5,
//     );

//     return resp.data.map((utxo) => ({
//         txid: utxo.txid,
//         value: utxo.amount,
//         script_hex: utxo.scriptPubKey,
//         output_no: utxo.vout,
//     }));
// };

export const fetchFromBitcoinDotCom = async (url: string): Promise<UTXO[]> => {
    const response = await retryNTimes(
        () => Axios.get<{
            utxos: Array<{
                address: string;
                txid: string;
                vout: number;
                scriptPubKey: string;
                amount: number;
                satoshis: number;
                confirmations: number;
                ts: number;
            }>
        }>(url, {
            // TTODO: Remove when certificate is fixed.
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        }),
        5,
    );
    return fixValues(response.data.utxos.map(utxo => ({
        txid: utxo.txid,
        value: utxo.amount,
        script_hex: utxo.scriptPubKey,
        output_no: utxo.vout,
        confirmations: utxo.confirmations,
    })), 8);
};

/**
 * Retrieves UTXOs for a BTC, ZEC or BCH address.
 *
 * @param network The Ren Network object
 * @param currencyName "BTC", "ZEC" or "BCH"
 *
 * @param address The BTC, ZEC or BCH address to retrieve the UTXOS for
 * @param confirmations Restrict UTXOs to having at least this many
 *        confirmations. If confirmations is 0, unconfirmed UTXOs are included.
 * @param endpoint An offset to allow trying different endpoints first, in case
 * o      one is out of sync.
 */
export const getUTXOs = (network: NetworkDetails, currencyName: string) => async (address: string, confirmations: number, endpoint = 0): Promise<Array<BitcoinUTXO | ZcashUTXO>> => {
    const chainSoFn = () => fetchFromChainSo(`https://chain.so/api/v2/get_tx_unspent/${currencyName}/${address}/${confirmations}`);

    let endpoints: Array<() => Promise<UTXO[]>> = [];
    if (currencyName.match(/btc/i)) {
        endpoints = [
            chainSoFn,
            () => fetchFromBlockstream(`https://blockstream.info/${network.isTestnet ? "testnet/" : ""}api/address/${address}/utxo`, `https://blockstream.info/${network.isTestnet ? "testnet/" : ""}api/blocks/tip/height`),
        ];
    } else if (currencyName.match(/zec/i)) {
        endpoints = [
            chainSoFn,
        ];
        if (network.isTestnet) {
            endpoints.push(() => fetchFromInsight(`https://explorer.testnet.z.cash/api/addr/${address}/utxo`));
        } else {
            endpoints.push(() => fetchFromInsight(`https://zcash.blockexplorer.com/api/addr/${address}/utxo`));
            // endpoints.push(() => fetchFromInsight(`https://zecblockexplorer.com/addr/${address}/utxo`));
            // endpoints.push(() => fetchFromZechain(`https://zechain.net/api/v1/addr/${address}/utxo`));
        }
    } else if (currencyName.match(/bch/i)) {
        if (network.isTestnet) {
            endpoints = [
                () => fetchFromBitcoinDotCom(`https://trest.bitcoin.com/v2/address/utxo/${address}`),
            ];
        } else {
            endpoints = [
                () => fetchFromBitcoinDotCom(`https://rest.bitcoin.com/v2/address/utxo/${address}`),
            ];
        }
    }

    let firstError;

    for (let i = 0; i < endpoints.length; i++) {
        try {
            return await endpoints[(i + endpoint) % endpoints.length]();
        } catch (error) {
            firstError = firstError || error;
        }
    }

    throw firstError || new Error(`No endpoints found for retrieving ${currencyName} UTXOs.`);
};
