import { Ox, strip0x } from "@renproject/ren-js-common";
import { Networks, Opcode, Script } from "bitcore-lib-cash";
import { getUTXOs } from "send-crypto/build/main/handlers/BCH/BCHHandler";

import { NetworkDetails, stringToNetwork } from "../types/networks";
import { createAddress } from "./common";

export const createBCHAddress = createAddress(Networks, Opcode, Script);

export const getBitcoinCashUTXOs = (network: NetworkDetails | string) => {
    const networkDetails = typeof network === "string" ? stringToNetwork(network) : network;
    return async (address: string, confirmations: number) => {
        return getUTXOs(networkDetails.isTestnet, { address, confirmations });
    };
};

export const bchAddressToHex = (address: string) => Ox(Buffer.from(address));

export const bchAddressFrom = (address: string, encoding: "hex" | "base64") => {
    return Buffer.from(encoding === "hex" ? strip0x(address) : address, encoding).toString();
};
