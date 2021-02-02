import { Callable } from "@renproject/utils";
import axios from "axios";

import { sortUTXOs, UTXO, DEFAULT_TIMEOUT, BitcoinAPI } from "./API";

export class BlockstreamClass implements BitcoinAPI {
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

    fetchUTXO = async (txHash: string, vOut: number): Promise<UTXO> => {
        const utxo = (
            await axios.get<BlockstreamTX>(this.getAPIUrl(`/tx/${txHash}`), {
                timeout: DEFAULT_TIMEOUT,
            })
        ).data;

        const heightResponse = (
            await axios.get<string>(this.getAPIUrl(`/blocks/tip/height`), {
                timeout: DEFAULT_TIMEOUT,
            })
        ).data;

        const confirmations = utxo.status.confirmed
            ? Math.max(
                  1 + parseInt(heightResponse, 10) - utxo.status.block_height,
                  0,
              )
            : 0;

        return {
            txHash,
            amount: utxo.vout[vOut].value.toString(),
            vOut,
            confirmations,
        };
    };

    fetchUTXOs = async (
        address: string,
        confirmations: number = 0,
    ): Promise<UTXO[]> => {
        const response = await axios.get<BlockstreamUTXO[]>(
            this.getAPIUrl(`/address/${address}/utxo`),
            { timeout: DEFAULT_TIMEOUT },
        );

        const heightResponse = await axios.get<string>(
            this.getAPIUrl(`/blocks/tip/height`),
            { timeout: DEFAULT_TIMEOUT },
        );

        return response.data
            .map((utxo) => ({
                txHash: utxo.txid,
                amount: utxo.value.toString(),
                vOut: utxo.vout,
                confirmations: utxo.status.confirmed
                    ? 1 +
                      parseInt(heightResponse.data, 10) -
                      utxo.status.block_height
                    : 0,
            }))
            .filter(
                (utxo) =>
                    confirmations === 0 || utxo.confirmations >= confirmations,
            )
            .sort(sortUTXOs);
    };

    fetchTXs = async (
        address: string,
        confirmations: number = 0,
    ): Promise<UTXO[]> => {
        const response = await axios.get<BlockstreamTX[]>(
            this.getAPIUrl(`/address/${address}/txs`),
            { timeout: DEFAULT_TIMEOUT },
        );

        const heightResponse = await axios.get<string>(
            this.getAPIUrl(`/blocks/tip/height`),
            { timeout: DEFAULT_TIMEOUT },
        );

        const received: UTXO[] = [];

        for (const tx of response.data) {
            for (let i = 0; i < tx.vout.length; i++) {
                const vout = tx.vout[i];
                if (vout.scriptpubkey_address === address) {
                    received.push({
                        txHash: tx.txid,
                        amount: vout.value.toString(),
                        vOut: i,
                        confirmations: tx.status.confirmed
                            ? 1 +
                              parseInt(heightResponse.data, 10) -
                              tx.status.block_height
                            : 0,
                    });
                }
            }
        }

        return received
            .filter(
                (utxo) =>
                    confirmations === 0 || utxo.confirmations >= confirmations,
            )
            .sort(sortUTXOs);
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

// @dev Removes any static fields.
export type Blockstream = BlockstreamClass;
export const Blockstream = Callable(BlockstreamClass);

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
