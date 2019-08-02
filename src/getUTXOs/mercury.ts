import Axios from "axios";
import BigNumber from "bignumber.js";

import { BitcoinUTXO } from "../blockchain/btc";
import { ZcashUTXO } from "../blockchain/zec";
import { retryNTimes } from "../lib/utils";

interface BlockstreamUTXO {
    status: unknown;
    txid: string;
    value: number;
    vout: number;
}

export const getUTXOs = (endpoint: string, network: string) => async (address: string, confirmations: number): Promise<Array<BitcoinUTXO | ZcashUTXO>> => {
    try {
        const resp = await retryNTimes(
            () => Axios.get<{ data: { txs: Array<BitcoinUTXO | ZcashUTXO> } }>(`${endpoint}/get_tx_unspent/${network}/${address}/${confirmations}`),
            5
        );
        const data = (resp.data);

        // Convert value to Satoshi
        for (const [, tx] of Object.entries(data.data.txs)) {
            // tslint:disable-next-line:no-any
            (tx as any).value = new BigNumber((tx as any).value).multipliedBy(10 ** 8).toNumber();
        }
        return data.data.txs;
    } catch (error) {
        if (network.match("BTC")) {
            console.error(error);
            const response = await retryNTimes(
                () => Axios.get<BlockstreamUTXO[]>(`https://blockstream.info/testnet/api/address/${address}/utxo`),
                5
            );

            return response.data.map(utxo => ({
                txid: utxo.txid,
                value: utxo.value,
                // Placeholder
                script_hex: "76a914b0c08e3b7da084d7dbe9431e9e49fb61fb3b64d788ac",
                output_no: utxo.vout,
            }));
        } else {
            throw error;
        }
    }
};

// Mainnet ZEC only!
// interface ZecChainUTXO {
//     address: string; // "t1eUHMR2k3NjZBuxmveSfee71otew7RFdwt"
//     txid: string; // "3b144316b919d01105378c0f4e3b1d3914c04d6b1ca009dae800295f1cfb35a8"
//     vout: number; // 0
//     scriptPubKey: string; // "76a914e1f180bffadc561719c64c76b2fa3efacf955e0088ac"
//     amount: number; // 0.11912954
//     satoshis: number; // 11912954
//     height: number; // 573459
//     confirmations: number; // 4
// }

// export const queryZecChain = (network: string) => async (address: string, confirmations: number): Promise<ZcashUTXO[]> => {
//     const resp = await retryNTimes(
//         () => Axios.get<ZecChainUTXO[]>(`https://zechain.net/api/v1/addr/${address}/utxo`),
//         5,
//     );

//     return resp.data.map((utxo) => ({
//         txid: utxo.txid,
//         value: utxo.amount,
//         script_hex: utxo.scriptPubKey,
//         output_no: utxo.vout,
//     }));
// };
