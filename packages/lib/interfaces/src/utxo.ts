export const x = 0;

// import { Chain } from "./renVM";

// export interface UTXOIndex {
//     readonly txHash: string; // hex string without 0x prefix
//     readonly vOut: number;
// }

// /**
//  * An unspent transaction.
//  * The amount should be in the smallest unit (e.g. Satoshis).
//  */
// export interface UTXO {
//     readonly txHash: string; // hex string without 0x prefix
//     readonly vOut: number;
//     readonly amount: number; // satoshis
//     readonly confirmations: number;
//     readonly scriptPubKey?: string; // hex string without 0x prefix
// }

// export type UTXOWithChain = { chain: Chain, utxo: UTXO };

// /**
//  * Tx refers to an Ethereum transaction and its hash, or a UTXO.
//  * RenVM only returns the address when releasing funds in response to a burn,
//  * so a Tx may include an address instead of a UTXO.
//  */
// export type Tx = {
//     chain: Chain;
//     transaction: UTXO;
// };
