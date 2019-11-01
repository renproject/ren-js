import { Networks, Opcode, Script } from "bitcore-lib-cash";
import { decode as decode58 } from "bs58";

import { getUTXOs } from "../getUTXOs/mercury";
import { NetworkDetails } from "../types/networks";
import { createAddress, Ox } from "./common";

export const createBCHAddress = createAddress(Networks, Opcode, Script);

export interface BCashUTXO {
    txid: string; // hex string without 0x prefix
    value: number; // satoshis
    script_hex: string; // hex string without 0x prefix
    output_no: number;
}

export const getBCashUTXOs = (network: NetworkDetails) => getUTXOs(network, network.chainSoName.bch);

export const bchAddressToHex = (address: string) => Ox(decode58(address));
