import { Networks, Opcode, Script } from "bitcore-lib-zcash";
import { decode as decode58 } from "bs58";

import { Network } from "../types/networks";
import { createAddress, Ox } from "./common";
import { getUTXOs } from "./mercury";

export const createZECAddress = createAddress(Networks, Opcode, Script);

export interface ZcashUTXO {
    txid: string; // hex string without 0x prefix
    value: number; // satoshis
    script_hex: string; // hex string without 0x prefix
    output_no: number;
}

export const getZcashUTXOs = (network: Network) => getUTXOs<ZcashUTXO>(network.chainSoURL, network.chainSoName.zec);

export const zecAddressToHex = (address: string) => Ox(decode58(address));
