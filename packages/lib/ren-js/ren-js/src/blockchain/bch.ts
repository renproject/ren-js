import { Ox, strip0x } from "@renproject/ren-js-common";
import { isMainnetAddress, isTestnetAddress, toCashAddress } from "bchaddrjs";
import { Networks, Opcode, Script } from "bitcore-lib-cash";
import { getUTXOs } from "send-crypto/build/main/handlers/BCH/BCHHandler";

import { NetworkDetails, stringToNetwork } from "../types/networks";
import { anyAddressFrom, Tactics } from "./btc";
import { createAddress } from "./common";

export const createBCHAddress = createAddress(Networks, Opcode, Script);

export const getBitcoinCashUTXOs = (network: NetworkDetails | string) => {
    const networkDetails = typeof network === "string" ? stringToNetwork(network) : network;
    return async (address: string, confirmations: number) => {
        return getUTXOs(networkDetails.isTestnet, { address, confirmations });
    };
};

export const bchAddressToHex = (address: string) => Ox(Buffer.from(address));

const isBCHAddress = (address: string, options?: { isTestnet?: boolean }) => {
    try {
        return options ?
            options.isTestnet ? isTestnetAddress(address) : isMainnetAddress(address) :
            isTestnetAddress(address) || isMainnetAddress(address);
    } catch (error) {
        return false;
    }
};

const bchTactics: Tactics = {
    decoders: [
        (address: string) => Buffer.from(address),
        (address: string) => Buffer.from(address, "base64"),
        (address: string) => Buffer.from(strip0x(address), "hex"),
    ],
    encoders: [
        (buffer: Buffer) => toCashAddress(buffer.toString()),
    ],
};

export const bchAddressFrom = anyAddressFrom(isBCHAddress, bchTactics);
