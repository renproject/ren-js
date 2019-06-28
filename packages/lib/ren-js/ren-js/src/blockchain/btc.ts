import { Networks, Opcode, Script } from "bitcore-lib";
import { decode as decode58 } from "bs58";

import { Network } from "../types/networks";
import { createAddress, Ox } from "./common";
import { getUTXOs } from "./mercury";

export const createBTCAddress = createAddress(Networks, Opcode, Script);

export interface BitcoinUTXO {
    txHash: string; // hex string without 0x prefix
    amount: number; // satoshis
    scriptPubKey: string; // hex string without 0x prefix
    vout: number;
}

export const getBitcoinUTXOs = (network: Network) => getUTXOs<BitcoinUTXO>(network.mercuryURL.btc);

export const btcAddressToHex = (address: string) => Ox(decode58(address));
