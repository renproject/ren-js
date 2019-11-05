import { Address, Networks, Opcode, Script } from "bitcore-lib-zcash";
import Base58Check from "bitcore-lib-zcash/lib/encoding/base58check";

import { getUTXOs } from "../getUTXOs/mercury";
import { NetworkDetails, stringToNetwork } from "../types/networks";
import { createAddress, Ox, strip0x } from "./common";

export const createZECAddress = createAddress(Networks, Opcode, Script);

export interface ZcashUTXO {
    txid: string; // hex string without 0x prefix
    value: number; // satoshis
    script_hex: string; // hex string without 0x prefix
    output_no: number;
}

export const getZcashUTXOs = (network: NetworkDetails | string) => {
    const networkDetails = typeof network === "string" ? stringToNetwork(network) : network;
    return getUTXOs(networkDetails, networkDetails.chainSoName.zec);
};

export const zecAddressToHex = (address: string) => {
    const addressBuffer = new Address(address).toBuffer();
    // Concatenate checksum
    return Ox(Buffer.concat([addressBuffer, Base58Check.checksum(addressBuffer)]));
};

export const zecAddressFrom = (address: string, encoding: "hex" | "base64") => {
    // tslint:disable-next-line: no-any
    return (Address as any)
        .fromBuffer(Buffer.from(encoding === "hex" ? strip0x(address) : address, encoding).slice(0, -4))
        .toString();
};
