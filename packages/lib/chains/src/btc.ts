import { Networks, Opcode, Script } from "bitcore-lib";
import { encode } from "bs58";
import { getConfirmations, getUTXOs } from "send-crypto/build/main/handlers/BTC/BTCHandler";
import { validate } from "wallet-address-validator";

import { createAddress } from "./common";
import { Ox, strip0x } from "./hex";

export const createBTCAddress = createAddress(Networks, Opcode, Script);

export const getBitcoinUTXOs = ({ isTestnet }: { isTestnet: boolean }) => {
    return async (address: string, confirmations: number) => {
        return getUTXOs(isTestnet, { address, confirmations });
    };
};

export const getBitcoinConfirmations = ({ isTestnet }: { isTestnet: boolean }) => {
    return async (txHash: string) => {
        return getConfirmations(isTestnet, txHash);
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

const isBTCAddress = (address: string) => validate(address, "btc", "testnet") || validate(address, "btc", "prod");

export interface Tactics {
    decoders: Array<(address: string) => Buffer>;
    encoders: Array<(buffer: Buffer) => string>;
}

const btcTactics: Tactics = {
    decoders: [
        (address: string) => Buffer.from(address),
        (address: string) => Buffer.from(address, "base64"),
        (address: string) => Buffer.from(strip0x(address), "hex"),
    ],
    encoders: [
        (buffer: Buffer) => encode(buffer), // base58
        (buffer: Buffer) => buffer.toString(),
    ],
};

export const anyAddressFrom =
    (isAnyAddress: (address: string) => boolean, { encoders, decoders }: Tactics) =>
        (address: string) => {
            for (const encoder of encoders) {
                for (const decoder of decoders) {
                    try {
                        const encoded = encoder(decoder(address));
                        if (isAnyAddress(encoded)) {
                            return encoded;
                        }
                    } catch (error) {
                        // Ignore errors
                    }
                }
            }
            return address;
        };

export const btcAddressFrom = anyAddressFrom(isBTCAddress, btcTactics);
