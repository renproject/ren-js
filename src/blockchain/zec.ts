import { Address, Networks, Opcode, Script } from "bitcore-lib-zcash";
import Base58Check from "bitcore-lib-zcash/lib/encoding/base58check";
import { getUTXOs } from "send-crypto/build/main/handlers/ZEC/ZECHandler";

import { Ox, strip0x } from "../lib/utils";
import { NetworkDetails, stringToNetwork } from "../types/networks";
import { createAddress } from "./common";

export const createZECAddress = createAddress(Networks, Opcode, Script);

export const getZcashUTXOs = (network: NetworkDetails | string) => {
    const networkDetails = typeof network === "string" ? stringToNetwork(network) : network;
    return async (address: string, confirmations: number) => {
        return getUTXOs(networkDetails.isTestnet, { address, confirmations });
    };
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
