// import https from "https";
import { utils } from "@renproject/utils";
import BigNumber from "bignumber.js";

import { BitcoinAPI, fixUTXO, fixValue, sortUTXOs, UTXO } from "./API";

export class Insight implements BitcoinAPI {
    public url: string;

    public constructor(url: string) {
        this.url = url.replace(/\/$/, "");
    }

    public fetchHeight = async (): Promise<string> => {
        return (
            await utils.GET<{ height: number }>(`${this.url}/sync`)
        ).height.toString();
    };

    public fetchUTXOs = async (
        address: string,
        confirmations: number = 0,
    ): Promise<UTXO[]> => {
        const url = `${this.url}/addr/${address}/utxo`;
        const response = await utils.GET<FetchUTXOResult>(
            url,
            // {
            //     // TODO: Remove when certificate is fixed.
            //     httpsAgent: new https.Agent({
            //         rejectUnauthorized: false,
            //     }),
            // }
        );

        const data: FetchUTXOResult =
            typeof response === "string" ? JSON.parse(response) : response;

        const height = new BigNumber(await this.fetchHeight());

        return (
            await Promise.all(
                data
                    .filter(
                        (utxo) =>
                            confirmations === 0 ||
                            utxo.confirmations >= confirmations,
                    )
                    .map((utxo) => ({
                        txid: utxo.txid,
                        txindex: utxo.vout.toString(),
                        amount: utils.isDefined(utxo.satoshis)
                            ? utxo.satoshis.toString()
                            : utils.isDefined(utxo.amount)
                            ? fixValue(utxo.amount, 8).toFixed()
                            : undefined,
                        height:
                            utxo.confirmations && utxo.confirmations > 0
                                ? height
                                      .minus(utxo.confirmations)
                                      .plus(1)
                                      .toFixed()
                                : null,
                    }))
                    // If the amount is undefined, fetch the UTXO again.
                    // This is due to the DigiByte explorer not returning
                    // amounts correctly when fetching UTXOs.
                    .map((utxo) =>
                        utils.isDefined(utxo.amount)
                            ? (utxo as UTXO)
                            : this.fetchUTXO(utxo.txid, utxo.txindex),
                    ),
            )
        ).sort(sortUTXOs);
    };

    public fetchTXs = async (address: string): Promise<UTXO[]> => {
        const url = `${this.url}/txs/?address=${address}`;
        const response = await utils.GET<FetchTXsResult>(
            url,
            // {
            //     // TODO: Remove when certificate is fixed.
            //     httpsAgent: new https.Agent({
            //         rejectUnauthorized: false,
            //     }),
            // }
        );

        const data: FetchTXsResult =
            typeof response === "string" ? JSON.parse(response) : response;

        const received: UTXO[] = [];

        for (const tx of data.txs) {
            for (let i = 0; i < tx.vout.length; i++) {
                const vout = tx.vout[i];
                if (vout.scriptPubKey.addresses.indexOf(address) >= 0) {
                    received.push({
                        txid: tx.txid,
                        txindex: i.toString(),
                        amount: fixValue(parseFloat(vout.value), 8).toFixed(),
                        height:
                            tx.blockheight && tx.blockheight > 0
                                ? tx.blockheight.toString()
                                : null,
                    });
                }
            }
        }

        return received.sort(sortUTXOs);
    };

    public fetchUTXO = async (txid: string, txindex: string): Promise<UTXO> => {
        const url = `${this.url}/tx/${txid}`;
        const tx = await utils.GET<TxResponse>(url);
        return fixUTXO(
            {
                txid,
                amount: tx.vout[parseInt(txindex, 10)].value.toString(),
                txindex,
                height:
                    tx.blockheight && tx.blockheight > 0
                        ? tx.blockheight.toString()
                        : null,
            },
            8,
        );
    };

    public broadcastTransaction = async (txHex: string): Promise<string> => {
        const url = `${this.url}/tx/send`;
        const response = await utils.POST<{
            error: string | null;
            id: null;
            txid: string;
        }>(url, { rawtx: txHex });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.txid;
    };
}

export interface ScriptSig {
    hex: string;
    asm: string;
}

export interface Vin {
    txid: string;
    vout: number;
    sequence: number;
    n: number;
    scriptSig: ScriptSig;
    addr: string;
    valueSat: number;
    value: number;
    doubleSpentTxID?: unknown;
}

export interface ScriptPubKey {
    hex: string; // "76a914ea06cb7aaf2b21e97ea9f43736731ee6a33366db88ac",
    asm: string; // "OP_DUP OP_HASH160 ea06cb7aaf2b21e97ea9f43736731ee6a33366db OP_EQUALVERIFY OP_CHECKSIG",
    addresses: string[]; // ["tmX3mbB2iAtGftpyp4BTmryma2REmuw8h8G"]
    type: string; // "pubkeyhash"
}

export interface Vout {
    value: string; // "0.00020000",
    n: number; // 0,
    scriptPubKey: ScriptPubKey;
    spentTxId: string; // "265760587a0631d613f13949a45bef1ec4c5fc38912081f4b58b4df51799ffb5",
    spentIndex: number; // 0,
    spentHeight: number; // 756027
}

export interface TxResponse {
    txid: string; // "fcc25c1a1f7df38ce15211b324385d837540dc0a97c3056f7497dacabef77c3f",
    version: number; // 4,
    locktime: number; // 0,
    vin: Vin[];
    vout: Vout[];
    vjoinsplit: unknown[]; // [],
    blockhash: string; // "0029b9051d06402b546532c1d0288684368fce5cc42c0b3e5aa032a35b74014b",
    blockheight: number; // 735468,
    confirmations: number; // 259430,
    time: number; // 1577073296,
    blocktime: number; // 1577073296,
    valueOut: number; // 0.0002,
    size: number; // 211,
    valueIn: number; // 0.0003,
    fees: number; // 0.0001,
    fOverwintered: boolean; // true,
    nVersionGroupId: number; // 2301567109,
    nExpiryHeight: number; // 0,
    valueBalance: number; // 0,
    spendDescs: unknown[]; // [],
    outputDescs: unknown[]; // []
}

export interface FetchTXsResult {
    pagesTotal: number;
    txs: TxResponse[];
}

type FetchUTXOResult = ReadonlyArray<{
    address: string;
    txid: string;
    vout: number;
    scriptPubKey: string;
    amount: number;
    satoshis: number;
    confirmations: number;
    ts: number;
}>;
