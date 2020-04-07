import { Chain } from "./renVM";

export interface UTXODetails {
    readonly txid: string; // hex string without 0x prefix
    readonly value: number; // satoshis
    readonly script_hex?: string; // hex string without 0x prefix
    readonly output_no: number;
    readonly confirmations: number;
}

export interface UTXOInput {
    readonly txid: string; // hex string without 0x prefix
    readonly output_no: number;
}

export type UTXO = { chain: Chain.Bitcoin | Chain.Zcash | Chain.BitcoinCash, utxo: UTXODetails };
