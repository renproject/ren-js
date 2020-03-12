import { Ox, strip0x } from "@renproject/interfaces";
import { Address, Networks, Opcode, Script } from "bitcore-lib-zcash";
import Base58Check from "bitcore-lib-zcash/lib/encoding/base58check";
import { encode } from "bs58";
import { getUTXOs } from "send-crypto/build/main/handlers/ZEC/ZECHandler";
import { validate } from "wallet-address-validator";

import { anyAddressFrom, Tactics } from "./btc";
import { createAddress } from "./common";

export const createZECAddress = createAddress(Networks, Opcode, Script);

export const getZcashUTXOs = ({ isTestnet }: { isTestnet: boolean }) => {
    return async (address: string, confirmations: number) => {
        return getUTXOs(isTestnet, { address, confirmations });
    };
};

export const zecAddressToHex = (address: string) => {
    const addressBuffer = new Address(address).toBuffer();
    // Concatenate checksum
    return Ox(Buffer.concat([addressBuffer, Base58Check.checksum(addressBuffer)]));
};

const isZECAddress = (address: string) => validate(address, "zec", "testnet") || validate(address, "zec", "prod");

const zecTactics: Tactics = {
    decoders: [
        (address: string) => Buffer.from(address),
        (address: string) => Buffer.from(address, "base64"),
        (address: string) => Buffer.from(strip0x(address), "hex"),
    ],
    encoders: [
        (buffer: Buffer) => buffer.toString(),
        (buffer: Buffer) => encode(buffer), // base58
    ],
};

export const zecAddressFrom = anyAddressFrom(isZECAddress, zecTactics);
