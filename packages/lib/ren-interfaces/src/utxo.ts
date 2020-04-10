import { Chain } from "./renVM";

export interface UTXOIndex {
    readonly txHash: string; // hex string without 0x prefix
    readonly vOut: number;
}

/**
 * A BTC, ZEC or BCH unspent transaction.
 * The amount should be in the smallest unit (e.g. Satoshis).
 */
export interface UTXO {
    readonly txHash: string; // hex string without 0x prefix
    readonly vOut: number;
    readonly amount: number; // satoshis
    readonly confirmations: number;
    readonly scriptPubKey?: string; // hex string without 0x prefix
}

export type UTXOWithChain = { chain: Chain.Bitcoin | Chain.Zcash | Chain.BitcoinCash, utxo: UTXO };

/**
 * Tx refers to an Ethereum transaction and its hash, or a BTC/ZEC/BCH UTXO.
 * RenVM only returns the address when releasing funds in response to a burn,
 * so a Tx may include an address instead of a UTXO.
 */
export type Tx = {
    chain: Chain.Bitcoin | Chain.Zcash | Chain.BitcoinCash;
    address?: string;
    utxo?: UTXO;
} | {
    chain: Chain.Ethereum;
    hash: string;
};
