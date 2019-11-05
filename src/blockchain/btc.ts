// import { Address, Networks, Opcode, Script } from "bitcore-lib";
// import Base58Check from "bitcore-lib/lib/encoding/base58check";
import { Networks, Opcode, Script } from "bitcore-lib";

import { getUTXOs } from "../getUTXOs/mercury";
import { NetworkDetails, stringToNetwork } from "../types/networks";
import { createAddress, Ox, strip0x } from "./common";

export const createBTCAddress = createAddress(Networks, Opcode, Script);

export interface BitcoinUTXO {
    txid: string; // hex string without 0x prefix
    value: number; // satoshis
    script_hex: string; // hex string without 0x prefix
    output_no: number;
}

export const getBitcoinUTXOs = (network: NetworkDetails | string) => {
    const networkDetails = typeof network === "string" ? stringToNetwork(network) : network;
    return getUTXOs(networkDetails, networkDetails.chainSoName.btc);
};

// export const btcAddressToHex = (address: string) => {
//     const addressBuffer = new Address(address).toBuffer();
//     // Concatenate checksum
//     return Ox(Buffer.concat([addressBuffer, Base58Check.checksum(addressBuffer)]));
// };

// export const btcAddressFrom = (address: string, encoding: "hex" | "base64") => {
//     // tslint:disable-next-line: no-any
//     return (Address as any)
//         .fromBuffer(Buffer.from(encoding === "hex" ? strip0x(address) : address, encoding).slice(0, -4))
//         .toString();
// };

export const btcAddressToHex = (address: string) => Ox(Buffer.from(address));

export const btcAddressFrom = (address: string, encoding: "hex" | "base64") => {
    return Buffer.from(encoding === "hex" ? strip0x(address) : address, encoding).toString();
};
