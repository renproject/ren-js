import { Networks, Opcode, Script } from "bitcore-lib-cash";

import { getUTXOs } from "../getUTXOs/mercury";
import { NetworkDetails, stringToNetwork } from "../types/networks";
import { createAddress, Ox, strip0x } from "./common";

export const createBCHAddress = createAddress(Networks, Opcode, Script);

export interface BCashUTXO {
    txid: string; // hex string without 0x prefix
    value: number; // satoshis
    script_hex: string; // hex string without 0x prefix
    output_no: number;
}

export const getBCashUTXOs = (network: NetworkDetails | string) => {
    const networkDetails = typeof network === "string" ? stringToNetwork(network) : network;
    return getUTXOs(networkDetails, networkDetails.chainSoName.bch);
};

export const bchAddressToHex = (address: string) => Ox(Buffer.from(address));

export const bchAddressFrom = (address: string, encoding: "hex" | "base64") => {
    return Buffer.from(encoding === "hex" ? strip0x(address) : address, encoding).toString();
};
