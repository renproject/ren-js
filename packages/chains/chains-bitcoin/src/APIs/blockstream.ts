import { utils } from "@renproject/utils";

import { BitcoinAPI, sortUTXOs, UTXO } from "./API";

export class Blockstream implements BitcoinAPI {
    public testnet: boolean;
    public apiKey: string | undefined;

    public constructor({ testnet = false, apiKey = undefined } = {}) {
        this.testnet = testnet;
        this.apiKey = apiKey;
    }

    public getAPIUrl = (path: string): string => {
        return `https://blockstream.info/${
            this.testnet ? "testnet/" : ""
        }api${path}${this.apiKey ? `?key=${this.apiKey}` : ""}`;
    };

    public fetchHeight = async (): Promise<string> => {
        return (
            await utils.GET<string>(this.getAPIUrl(`/blocks/tip/height`))
        ).toString();
    };

    public fetchUTXO = async (txid: string, txindex: string): Promise<UTXO> => {
        const utxo = await utils.GET<BlockstreamTX>(
            this.getAPIUrl(`/tx/${txid}`),
        );

        return {
            txid,
            amount: utxo.vout[parseInt(txindex, 10)].value.toString(),
            txindex,
            height: utxo.status.confirmed
                ? utxo.status.block_height.toString()
                : null,
        };
    };

    public fetchUTXOs = async (address: string): Promise<UTXO[]> => {
        const response = await utils.GET<BlockstreamUTXO[]>(
            this.getAPIUrl(`/address/${address}/utxo`),
        );

        return response
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

    public fetchTXs = async (address: string): Promise<UTXO[]> => {
        const response = await utils.GET<BlockstreamTX[]>(
            this.getAPIUrl(`/address/${address}/txs`),
        );

        const received: UTXO[] = [];

        for (const tx of response) {
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

    public broadcastTransaction = async (txHex: string): Promise<string> => {
        const response = await utils.POST<string>(this.getAPIUrl(`/tx`), txHex);
        return response;
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
