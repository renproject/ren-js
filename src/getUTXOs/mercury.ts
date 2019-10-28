import Axios from "axios";
import BigNumber from "bignumber.js";
import https from "https";

import { BitcoinUTXO } from "../blockchain/btc";
import { ZcashUTXO } from "../blockchain/zec";
import { retryNTimes } from "../lib/utils";
import { NetworkDetails } from "../types/networks";

export const fetchFromChainSo = async (url: string) => {
    const resp = await retryNTimes(
        () => Axios.get<{ data: { txs: Array<BitcoinUTXO | ZcashUTXO> } }>(url),
        5.
    );
    const data = (resp.data);

    // Convert value to Satoshi
    for (const [, tx] of Object.entries(data.data.txs)) {
        // tslint:disable-next-line:no-any
        (tx as any).value = new BigNumber((tx as any).value).multipliedBy(10 ** 8).toNumber();
    }
    return data.data.txs;
};

export const fetchFromBlockstream = async (url: string) => {
    const response = await retryNTimes(
        () => Axios.get<Array<{
            status: unknown;
            txid: string;
            value: number;
            vout: number;
        }>>(url),
        5,
    );

    return response.data.map(utxo => ({
        txid: utxo.txid,
        value: utxo.value,
        // Placeholder
        script_hex: "76a914b0c08e3b7da084d7dbe9431e9e49fb61fb3b64d788ac",
        output_no: utxo.vout,
    }));
};

export const fetchFromInsight = async (url: string) => {
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
    return response.data.map(utxo => ({
        txid: utxo.txid,
        value: utxo.amount,
        script_hex: utxo.scriptPubKey,
        output_no: utxo.vout,
    }));
};

export const fetchFromZechain = async (url: string): Promise<ZcashUTXO[]> => {
    // Mainnet ZEC only!
    const resp = await retryNTimes(
        () => Axios.get<Array<{
            address: string; // "t1eUHMR2k3NjZBuxmveSfee71otew7RFdwt"
            txid: string; // "3b144316b919d01105378c0f4e3b1d3914c04d6b1ca009dae800295f1cfb35a8"
            vout: number; // 0
            scriptPubKey: string; // "76a914e1f180bffadc561719c64c76b2fa3efacf955e0088ac"
            amount: number; // 0.11912954
            satoshis: number; // 11912954
            height: number; // 573459
            confirmations: number; // 4
        }>>(url),
        5,
    );

    return resp.data.map((utxo) => ({
        txid: utxo.txid,
        value: utxo.amount,
        script_hex: utxo.scriptPubKey,
        output_no: utxo.vout,
    }));
};

/**
 * Retrieves UTXOs for a BTC or ZEC address.
 *
 * @param network The Ren Network object
 * @param currencyName "BTC" or "ZEC"
 *
 * @param address The BTC or ZEC address to retrieve the UTXOS for
 * @param confirmations Restrict UTXOs to having at least this many
 *        confirmations. If confirmations is 0, unconfirmed UTXOs are included.
 * @param endpoint An offset to allow trying different endpoints first, in case
 * o      one is out of sync.
 */
export const getUTXOs = (network: NetworkDetails, currencyName: string) => async (address: string, confirmations: number, endpoint = 0): Promise<Array<BitcoinUTXO | ZcashUTXO>> => {
    const chainSoFn = () => fetchFromChainSo(`${network.chainSoURL}/get_tx_unspent/${currencyName}/${address}/${confirmations}`);
    const blockstreamFn = () => fetchFromBlockstream(`https://blockstream.info/${network.isTestnet ? "testnet/" : ""}api/address/${address}/utxo`);
    const insightFn = () => fetchFromInsight(`https://explorer.testnet.z.cash/api/addr/${address}/utxo`);

    const endpoints = [chainSoFn];
    if (currencyName.match("BTC")) {
        endpoints.push(blockstreamFn);
    } else if (currencyName.match("ZEC")) {
        endpoints.push(insightFn);
        // Mainnet only!
        // return fetchFromInsight(`https://zecblockexplorer.com/addr/${address}/utxo`);
        // return fetchFromZechain(`https://zechain.net/api/v1/addr/${address}/utxo`);
    }

    let firstError;

    for (let i = 0; i < endpoints.length; i++) {
        try {
            return await endpoints[(i + endpoint) % endpoints.length]();
        } catch (error) {
            firstError = firstError || error;
        }
    }

    throw firstError;
};
