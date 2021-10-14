import axios from "axios";

import { BitcoinAPI, DEFAULT_TIMEOUT, sortUTXOs, UTXO } from "./API";

export class Blockstream implements BitcoinAPI {
    public testnet: boolean;
    public apiKey: string | undefined;

    constructor({ testnet = false, apiKey = undefined } = {}) {
        this.testnet = testnet;
        this.apiKey = apiKey;
    }

    getAPIUrl = (path: string) =>
        `https://blockstream.info/${this.testnet ? "testnet/" : ""}api${path}${
            this.apiKey ? `?key=${this.apiKey}` : ""
        }`;

    fetchHeight = async (): Promise<string> =>
        (
            await axios.get<string>(this.getAPIUrl(`/blocks/tip/height`), {
                timeout: DEFAULT_TIMEOUT,
            })
        ).data.toString();

    fetchUTXO = async (txid: string, txindex: string): Promise<UTXO> => {
        const utxo = (
            await axios.get<BlockstreamTX>(this.getAPIUrl(`/tx/${txid}`), {
                timeout: DEFAULT_TIMEOUT,
            })
        ).data;

        return {
            txid,
            amount: utxo.vout[parseInt(txindex, 10)].value.toString(),
            txindex,
            height: utxo.status.confirmed
                ? utxo.status.block_height.toString()
                : null,
        };
    };

    fetchUTXOs = async (address: string): Promise<UTXO[]> => {
        const response = await axios.get<BlockstreamUTXO[]>(
            this.getAPIUrl(`/address/${address}/utxo`),
            { timeout: DEFAULT_TIMEOUT },
        );

        return response.data
            .map((utxo) => ({
                txid: utxo.txid,
                amount: utxo.value.toString(),
                txindex: utxo.vout.toString(),
                height: utxo.status.confirmed
                    ? utxo.status.block_height.toString()
                    : null,
            }))
            .sort(sortUTXOs);
    };

    fetchTXs = async (address: string): Promise<UTXO[]> => {
        const response = await axios.get<BlockstreamTX[]>(
            this.getAPIUrl(`/address/${address}/txs`),
            { timeout: DEFAULT_TIMEOUT },
        );

        const received: UTXO[] = [];

        for (const tx of response.data) {
            for (let i = 0; i < tx.vout.length; i++) {
                const vout = tx.vout[i];
                if (vout.scriptpubkey_address === address) {
                    received.push({
                        txid: tx.txid,
                        amount: vout.value.toString(),
                        txindex: i.toString(),
                        height: tx.status.confirmed
                            ? tx.status.block_height.toString()
                            : null,
                    });
                }
            }
        }

        return received.sort(sortUTXOs);
    };

    broadcastTransaction = async (txHex: string): Promise<string> => {
        const response = await axios.post<string>(
            this.getAPIUrl(`/tx`),
            txHex,
            {
                timeout: DEFAULT_TIMEOUT,
            },
        );
        return response.data;
    };
}

interface BlockstreamUTXO<vout = number> {
    status:
        | {
              confirmed: false;
          }
        | {
              confirmed: true;
              block_height: number;
              block_hash: string;
              block_time: number;
          };
    txid: string;
    value: number;
    vout: vout; // vout is a number for utxos, or an array of utxos for a tx
}

interface BlockstreamTX
    extends BlockstreamUTXO<
        Array<{
            scriptpubkey: string;
            scriptpubkey_asm: string;
            scriptpubkey_type: string;
            scriptpubkey_address: string;
            value: number; // e.g. 1034439
        }>
    > {
    version: number;
    locktime: number;
    vin: Array<{
        txid: string;
        vout: number;
        prevout: unknown;
        scriptsig: string;
        scriptsig_asm: string;
        is_coinbase: false;
        sequence: number;
    }>;
    size: number;
    weight: number;
    fee: number;
}
