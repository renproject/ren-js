import { Networks, Opcode, Script } from "bitcore-lib";
import { getUTXOs } from "send-crypto/build/main/handlers/BTC/BTCHandler";

import { Ox, strip0x } from "../lib/utils";
import { NetworkDetails, stringToNetwork } from "../types/networks";
import { createAddress } from "./common";

export const createBTCAddress = createAddress(Networks, Opcode, Script);

export const getBitcoinUTXOs = (network: NetworkDetails | string) => {
    const networkDetails = typeof network === "string" ? stringToNetwork(network) : network;
    return async (address: string, confirmations: number) => {
        return getUTXOs(networkDetails.isTestnet, { address, confirmations });
    };
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
