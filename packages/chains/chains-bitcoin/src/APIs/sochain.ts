import axios from "axios";
import BigNumber from "bignumber.js";

import {
    BitcoinAPI,
    DEFAULT_TIMEOUT,
    fixUTXO,
    fixUTXOs,
    sortUTXOs,
    UTXO,
} from "./API";

export enum SoChainNetwork {
    BTC = "BTC",
    LTC = "LTC",
    ZEC = "ZEC",
    DOGE = "DOGE",
    DASH = "DASH",
    BTCTEST = "BTCTEST",
    LTCTEST = "LTCTEST",
    ZECTEST = "ZECTEST",
    DOGETEST = "DOGETEST",
    DASHTEST = "DASHTEST",
}

export class SoChain implements BitcoinAPI {
    public network: string;

    public constructor(network: SoChainNetwork | string = SoChainNetwork.BTC) {
        this.network = network;
    }

    public async fetchHeight(): Promise<string> {
        return (
            await axios.get<{ blocks: number }>(
                `https://sochain.com/api/v2/get_info/${this.network}`,
                {
                    timeout: DEFAULT_TIMEOUT,
                },
            )
        ).data.blocks.toString();
    }

    public async fetchUTXO(txid: string, txindex: string): Promise<UTXO> {
        const url = `https://sochain.com/api/v2/get_tx/${this.network}/${txid}`;
        const response = await axios.get<{
            readonly data: SoChainTX;
        }>(url, { timeout: DEFAULT_TIMEOUT });

        const tx = response.data.data;

        const height = new BigNumber(await this.fetchHeight());

        return fixUTXO(
            {
                txid: tx.txid,
                amount: tx.outputs[parseInt(txindex, 10)].value.toString(),
                txindex: txindex,
                height:
                    tx.confirmations && tx.confirmations > 0
                        ? height.minus(tx.confirmations).plus(1).toFixed()
                        : null,
            },
            8,
        );
    }

    public async fetchUTXOs(address: string): Promise<UTXO[]> {
        const url = `https://sochain.com/api/v2/get_tx_unspent/${
            this.network
        }/${address}/${0}`;
        const response = await axios.get<{
            data: { txs: SoChainUTXO[] };
        }>(url, { timeout: DEFAULT_TIMEOUT });

        const height = new BigNumber(await this.fetchHeight());

        return fixUTXOs(
            response.data.data.txs.map((utxo) => ({
                txid: utxo.txid,
                txindex: utxo.output_no.toString(),
                amount: utxo.value.toString(),
                height:
                    utxo.confirmations && utxo.confirmations > 0
                        ? height.minus(utxo.confirmations).plus(1).toFixed()
                        : null,
            })),
            8,
        ).sort(sortUTXOs);
    }

    public async fetchTXs(address: string): Promise<UTXO[]> {
        const url = `https://sochain.com/api/v2/get_tx_received/${
            this.network
        }/${address}/${0}`;
        const response = await axios.get<{
            readonly data: { readonly txs: readonly SoChainUTXO[] };
        }>(url, { timeout: DEFAULT_TIMEOUT });

        const height = new BigNumber(await this.fetchHeight());

        return fixUTXOs(
            response.data.data.txs.map((utxo) => ({
                txid: utxo.txid,
                amount: utxo.value.toString(),
                // scriptPubKey: utxo.script_hex,
                txindex: utxo.output_no.toString(),
                height:
                    utxo.confirmations && utxo.confirmations > 0
                        ? height.minus(utxo.confirmations).plus(1).toFixed()
                        : null,
            })),
            8,
        ).sort(sortUTXOs);
    }

    public async broadcastTransaction(txHex: string): Promise<string> {
        const response = await axios.post<{
            status: "success";
            data: {
                network: string;
                txid: string; // Hex without 0x
            };
        }>(
            `https://sochain.com/api/v2/send_tx/${this.network}`,
            { tx_hex: txHex },
            { timeout: DEFAULT_TIMEOUT },
        );
        return response.data.data.txid;
    }
}

export interface SoChainUTXO {
    txid: string; // hex string without 0x prefix
    value: number; // satoshis
    script_asm: string;
    script_hex: string; // hex string without 0x prefix
    output_no: number;
    confirmations: number;
    time: number;
}

export interface SoChainTX {
    network: string; // "BTC";
    txid: string; // "756548eb92505a7214b66faa8d1a77116e92d81d40b8d5a5c997dd83d1efb53b";
    blockhash: string | null;
    confirmations: number; // 0;
    time: number; // 1600217073;
    inputs: Array<{
        input_no: number; // 0;
        value: string; // "0.06498884";
        address: string; // "1JHKKk18HD6bgy4FKkJaVxCZpBx3hhRocf";
        type: "pubkeyhash";
        script: string; // "3045022100dccc5915d63e50506c962179cd11e78e94d86b1c6815daf1ad8362e75543196a022053285e92aa92dce92745d59c5a6cafd349c4657f5c1007ca31592fda63c9437d01 0363dd6554e3d3263df30c24beaf3f4fb5b2db3d0679d92615fb2e67d697648085";
        witness: null;
        from_output: {
            txid: string; // "229833c1bb68984721dba4ccfcfb092ec8ea000fd96de300baa49a2009ae5def";
            output_no: number; // 1;
        };
    }>;
    outputs: Array<{
        output_no: 0;
        value: string; // "0.00980175";
        address: string; // "19Hb9HH2QK5v38NAwQuEmLwngu5HJqqRjm";
        type: "pubkeyhash";
        script: string; // "OP_DUP OP_HASH160 5ae429a0a453e9d3e4e350717569315092e1f917 OP_EQUALVERIFY OP_CHECKSIG";
    }>;
    tx_hex: string;
    size: number;
    version: 1;
    locktime: 0;
}
