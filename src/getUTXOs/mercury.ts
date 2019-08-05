import Axios from "axios";
import BigNumber from "bignumber.js";

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
        }>>(url),
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

export const getUTXOs = (network: NetworkDetails, currencyName: string) => async (address: string, confirmations: number): Promise<Array<BitcoinUTXO | ZcashUTXO>> => {
    try {
        // Try from chain.so
        return fetchFromChainSo(`${network.chainSoURL}/get_tx_unspent/${currencyName}/${address}/${confirmations}`);
    } catch (chainSoError) {
        // tslint:disable: no-console
        console.error(chainSoError);
        if (currencyName.match("BTC")) {
            try {
                // Try blockstream.info for testnet BTC
                return fetchFromBlockstream(`https://blockstream.info/testnet/api/address/${address}/utxo`);
            } catch (error) {
                console.error(error);
            }
        } else if (currencyName.match("ZEC")) {
            try {
                // Try z.cash explorer for testnet ZEC
                return fetchFromInsight(`https://explorer.testnet.z.cash/api/addr/${address}/utxo`);
            } catch (error) {
                console.error(error);
            }
            // Mainnet only!
            // return fetchFromInsight(`https://zecblockexplorer.com/addr/${address}/utxo`);
            // return fetchFromZechain(`https://zechain.net/api/v1/addr/${address}/utxo`);
        }

        throw chainSoError;
    }
    // tslint:enable: no-console
};
