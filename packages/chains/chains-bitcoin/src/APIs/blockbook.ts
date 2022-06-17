// import https from "https";

import { utils } from "@renproject/utils";

import { BitcoinAPI, fixUTXO, fixValue, sortUTXOs, UTXO } from "./API";

export class Blockbook implements BitcoinAPI {
    public url: string;

    public constructor(url: string) {
        this.url = url.replace(/\/$/, "");
    }

    public fetchHeight = async (): Promise<string> => {
        return (
            await utils.GET<{ bestHeight: number }>(`${this.url}`)
        ).bestHeight.toString();
    };

    public fetchUTXOs = async (address: string): Promise<UTXO[]> => {
        const url = `${this.url}/utxo/${address}`;
        const response = await utils.GET<FetchUTXOResult>(url);

        const data: FetchUTXOResult =
            typeof response === "string" ? JSON.parse(response) : response;

        return (
            await Promise.all(
                data
                    .map((utxo) => ({
                        txid: utxo.txid,
                        amount: utils.isDefined(utxo.satoshis)
                            ? utxo.satoshis.toString()
                            : utils.isDefined(utxo.amount)
                            ? fixValue(utxo.amount, 8).toFixed()
                            : undefined,
                        txindex: utxo.vout.toString(),
                        height:
                            utxo.height && utxo.height > 0
                                ? utxo.height.toString()
                                : null,
                    }))
                    // If the amount is undefined, fetch the UTXO again.
                    // This is due to the Digibyte explorer not returning
                    // amounts correctly when fetching UTXOs.
                    .map((utxo) =>
                        utils.isDefined(utxo.amount)
                            ? (utxo as UTXO)
                            : this.fetchUTXO(utxo.txid, utxo.txindex),
                    ),
            )
        ).sort(sortUTXOs);
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
    txid: string; // "ba53af50677ba259e2c5bd0915a0e42fce10003df786fe94d2030b02a5fa8dfe"
    vout: number; // 0
    amount: string; // "486.71772246"
    satoshis: number; // 48671772246
    height: number; // 13769953
    confirmations: number; // 9
}>;
