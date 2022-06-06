import { utils } from "@renproject/utils";
import BigNumber from "bignumber.js";
import qs from "qs";

import { BitcoinAPI, sortUTXOs, UTXO } from "./API";

export enum BlockchainNetwork {
    Bitcoin = "btc",
    BitcoinCash = "bch",
    BitcoinTestnet = "btc-testnet",
    BitcoinCashTestnet = "bch-testnet",
}

interface BlockchainTransaction {
    txid: string; // "550b293355f5274e513c65f846311fd5817d13bcfcd492ab94ff2725ba94f21e"
    size: number; // 124
    version: number; // 1
    locktime: number; // 0
    fee: number; // 0
    inputs: [
        {
            coinbase: boolean; // true
            txid: string; // "0000000000000000000000000000000000000000000000000000000000000000"
            output: number; // 4294967295
            sigscript: string; // "03e3b9162f696d2f"
            sequence: number; // 4294967295
            pkscript: null;
            value: null;
            address: null;
            witness: unknown[];
        },
    ];
    outputs: [
        {
            address: string; // "bchtest:qp7k5sm9dcmvse2rgmkj2ktylm9fgqcnv5kp2hrs0h"
            pkscript: string; // "76a9147d6a43656e36c8654346ed255964feca9403136588ac"
            value: number; // 39062500
            spent: boolean; // false
            spender: null;
        },
        {
            address: null;
            pkscript: string; // "6a14883805620000000000000000faee4177fe240000"
            value: number; // 0
            spent: boolean; // false
            spender: null;
        },
    ];
    block: {
        height?: number; // 1489379
        position?: number; // 0
        mempool?: number;
    };
    deleted: boolean; // false
    time: number; // 1646186011
    rbf: boolean; // false
    weight: number; // 496
}

export class Blockchain implements BitcoinAPI {
    public network: BlockchainNetwork;
    public url: string;

    public constructor(network: BlockchainNetwork) {
        this.network = network;
        this.url = `https://api.blockchain.info/haskoin-store/${network}`;
    }

    public fetchHeight = async (): Promise<string> => {
        const statsUrl = `${this.url}/block/best?notx=true`;
        const statsResponse = await utils.GET<{ height: number }>(statsUrl);
        return statsResponse.height.toString();
    };

    public fetchUTXO = async (txid: string, txindex: string): Promise<UTXO> => {
        const url = `${this.url}/transaction/${txid}`;

        const response = await utils.GET<BlockchainTransaction>(`${url}`);

        return {
            txid: txid,
            txindex: txindex.toString(),
            amount: response.outputs[txindex].value.toString(),
            height: response.block.height
                ? response.block.height.toString()
                : null,
        };
    };

    public fetchUTXOs = async (
        address: string,
        confirmations: number = 0,
        limit: number = 25,
        offset: number = 0,
    ): Promise<UTXO[]> =>
        this.fetchTXs(address, confirmations, limit, offset, true);

    public fetchTXs = async (
        address: string,
        _confirmations: number = 0,
        limit: number = 25,
        offset: number = 0,
        onlyUnspent: boolean = false,
    ): Promise<UTXO[]> => {
        const url = `${this.url}/address/${address}/transactions/full?limit=${limit}&offset=${offset}`;
        const response = await utils.GET<BlockchainTransaction[]>(url);

        let latestBlock: BigNumber | undefined;

        const received: UTXO[] = [];

        for (const tx of response) {
            latestBlock =
                latestBlock || new BigNumber(await this.fetchHeight());
            for (let i = 0; i < tx.outputs.length; i++) {
                const output = tx.outputs[i];
                if (
                    output.address === address &&
                    // If the onlyUnspent flag is true, check that the tx is unspent.
                    (!onlyUnspent || output.spent === false)
                ) {
                    received.push({
                        txid: tx.txid,
                        amount: output.value.toString(),
                        txindex: i.toString(),
                        height: tx.block.height
                            ? tx.block.height.toString()
                            : null,
                    });
                }
            }
        }

        return (
            received
                // .filter(
                //     (utxo) =>
                //         confirmations === 0 || utxo.confirmations >= confirmations,
                // )
                .sort(sortUTXOs)
        );
    };

    public broadcastTransaction = async (txHex: string): Promise<string> => {
        if (this.network !== BlockchainNetwork.Bitcoin) {
            throw new Error(
                `Broadcasting ${this.network} transactions not supported by endpoint.`,
            );
        }
        const url = `https://blockchain.info/pushtx`;

        const response = await utils.POST<string | { error: string }>(
            url,
            qs.stringify({ tx: txHex }),
            // URL-encoded params
            {
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                },
            },
        );
        if (typeof response === "object" && response.error) {
            throw new Error(response.error);
        }

        // Check response type.
        return String(response);
    };
}
