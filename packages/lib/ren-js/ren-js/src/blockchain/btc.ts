import { Address, Networks, Opcode, Script } from "bitcore-lib";
import Base58Check from "bitcore-lib/lib/encoding/base58check";

import { getUTXOs } from "../getUTXOs/mercury";
import { NetworkDetails } from "../types/networks";
import { createAddress, Ox } from "./common";

export const createBTCAddress = createAddress(Networks, Opcode, Script);

export interface BitcoinUTXO {
    txid: string; // hex string without 0x prefix
    value: number; // satoshis
    script_hex: string; // hex string without 0x prefix
    output_no: number;
}

export const getBitcoinUTXOs = (network: NetworkDetails) => getUTXOs(network, network.chainSoName.btc);

export const btcAddressToHex = (address: string) => {
    const addressBuffer = new Address(address).toBuffer();
    // Concatenate checksum
    return Ox(Buffer.concat([addressBuffer, Base58Check.checksum(addressBuffer)]));
};
