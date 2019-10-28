import { Address, Networks, Opcode, Script } from "bitcore-lib-zcash";
import Base58Check from "bitcore-lib-zcash/lib/encoding/base58check";

import { getUTXOs } from "../getUTXOs/mercury";
import { NetworkDetails } from "../types/networks";
import { createAddress, Ox } from "./common";

export const createZECAddress = createAddress(Networks, Opcode, Script);

export interface ZcashUTXO {
    txid: string; // hex string without 0x prefix
    value: number; // satoshis
    script_hex: string; // hex string without 0x prefix
    output_no: number;
}

export const getZcashUTXOs = (network: NetworkDetails) => getUTXOs(network, network.chainSoName.zec);

export const zecAddressToHex = (address: string) => {
    const addressBuffer = new Address(address).toBuffer();
    // Concatenate checksum
    return Ox(Buffer.concat([addressBuffer, Base58Check.checksum(addressBuffer)]));
};
