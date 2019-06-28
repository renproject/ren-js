import { Networks, Opcode, Script } from "bitcore-lib";
import { decode as decode58 } from "bs58";

import { createAddress, Ox } from "./common";
import { getUTXOs } from "./mercury";

export const createBTCAddress = createAddress(Networks, Opcode, Script);

const testnetAPI = "https://chain.so/api/v2";

export interface BitcoinUTXO {
    txid: string; // hex string without 0x prefix
    value: number; // satoshis
    script_hex: string; // hex string without 0x prefix
    output_no: number;
}

export const getBTCTestnetUTXOs = getUTXOs<BitcoinUTXO>(testnetAPI, "BTCTEST");

export const btcAddressToHex = (address: string) => Ox(decode58(address));
