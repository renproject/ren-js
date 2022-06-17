// MIT License

// Copyright (c) 2018-2020 Emilio Almansi

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { utils } from "@renproject/utils";
import { InvalidAddressError } from "bchaddrjs";
import base58 from "bs58";
import bs58check from "bs58check";
import cashaddr, { ValidationError } from "cashaddrjs";

enum Format {
    Legacy = "legacy",
    Bitpay = "bitpay",
    Cashaddr = "cashaddr",
}

enum Network {
    Mainnet = "mainnet",
    Testnet = "testnet",
}

enum Type {
    P2PKH = "p2pkh",
    P2SH = "p2sh",
}

const VERSION_BYTE = {
    [Format.Legacy]: {
        [Network.Mainnet]: {
            [Type.P2PKH]: 0,
            [Type.P2SH]: 5,
        },
        [Network.Testnet]: {
            [Type.P2PKH]: 111,
            [Type.P2SH]: 196,
        },
    },
    [Format.Bitpay]: {
        [Network.Mainnet]: {
            [Type.P2PKH]: 28,
            [Type.P2SH]: 40,
        },
        [Network.Testnet]: {
            [Type.P2PKH]: 111,
            [Type.P2SH]: 196,
        },
    },
};

const BASE_58_CHECK_PAYLOAD_LENGTH = 21;

const decodeBase58Address = (address: string) => {
    try {
        const payload = bs58check.decode(address);
        if (payload.length !== BASE_58_CHECK_PAYLOAD_LENGTH) {
            throw new InvalidAddressError();
        }
        const versionByte = payload[0];
        const hash = Array.prototype.slice.call(payload, 1);
        switch (versionByte) {
            case VERSION_BYTE[Format.Legacy][Network.Mainnet][Type.P2PKH]:
                return {
                    hash: hash,
                    format: Format.Legacy,
                    network: Network.Mainnet,
                    type: Type.P2PKH,
                };
            case VERSION_BYTE[Format.Legacy][Network.Mainnet][Type.P2SH]:
                return {
                    hash: hash,
                    format: Format.Legacy,
                    network: Network.Mainnet,
                    type: Type.P2SH,
                };
            case VERSION_BYTE[Format.Legacy][Network.Testnet][Type.P2PKH]:
                return {
                    hash: hash,
                    format: Format.Legacy,
                    network: Network.Testnet,
                    type: Type.P2PKH,
                };
            case VERSION_BYTE[Format.Legacy][Network.Testnet][Type.P2SH]:
                return {
                    hash: hash,
                    format: Format.Legacy,
                    network: Network.Testnet,
                    type: Type.P2SH,
                };
            case VERSION_BYTE[Format.Bitpay][Network.Mainnet][Type.P2PKH]:
                return {
                    hash: hash,
                    format: Format.Bitpay,
                    network: Network.Mainnet,
                    type: Type.P2PKH,
                };
            case VERSION_BYTE[Format.Bitpay][Network.Mainnet][Type.P2SH]:
                return {
                    hash: hash,
                    format: Format.Bitpay,
                    network: Network.Mainnet,
                    type: Type.P2SH,
                };
        }
    } catch (error: unknown) {
        // Ignore error.
    }
    throw new InvalidAddressError();
};

const decodeCashAddressWithPrefix = (address: string) => {
    try {
        const decoded = cashaddr.decode(address);
        const hash = Array.prototype.slice.call(decoded.hash, 0);
        const type = decoded.type === "P2PKH" ? Type.P2PKH : Type.P2SH;
        switch (decoded.prefix) {
            case "bitcoincash":
                return {
                    hash: hash,
                    format: Format.Cashaddr,
                    network: Network.Mainnet,
                    type: type,
                };
            case "bchtest":
            case "bchreg":
                return {
                    hash: hash,
                    format: Format.Cashaddr,
                    network: Network.Testnet,
                    type: type,
                };
        }
    } catch (error: unknown) {
        // Ignore error.
    }
    throw new InvalidAddressError();
};

const decodeCashAddress = (address: string) => {
    if (address.indexOf(":") !== -1) {
        try {
            return decodeCashAddressWithPrefix(address);
        } catch (error: unknown) {
            // Ignore error.
        }
    } else {
        const prefixes = ["bitcoincash", "bchtest", "bchreg"];
        for (let i = 0; i < prefixes.length; ++i) {
            try {
                const prefix = prefixes[i];
                return decodeCashAddressWithPrefix(prefix + ":" + address);
            } catch (error: unknown) {
                // Ignore error.
            }
        }
    }
    throw new InvalidAddressError();
};

const getTypeBits = (type: string) => {
    switch (type.toLowerCase()) {
        case Type.P2PKH:
            return 0;
        case Type.P2SH:
            return 8;
        default:
            throw new ValidationError("Invalid type: " + type + ".");
    }
};

export const decodeBitcoinCashAddress = (address: string): Uint8Array => {
    try {
        // Validate checksum:
        const _check = decodeBase58Address(address);
        return new Uint8Array(base58.decode(address));
    } catch (error: unknown) {
        // Ignore error.
    }
    try {
        const { hash, type } = decodeCashAddress(address);
        return utils.concat([
            new Uint8Array([getTypeBits(type)]),
            new Uint8Array(hash),
        ]);
    } catch (error: unknown) {
        // Ignore error.
    }
    throw new InvalidAddressError();
};
