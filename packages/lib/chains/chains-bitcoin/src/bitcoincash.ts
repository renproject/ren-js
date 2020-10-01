import { Callable } from "@renproject/utils";
import { toCashAddress } from "bchaddrjs";
import { Networks, Opcode, Script } from "bitcore-lib-cash";
import base58 from "bs58";
import { BCHHandler } from "send-crypto/build/main/handlers/BCH/BCHHandler";
import { validate } from "wallet-address-validator";

import { Address, BitcoinNetwork } from "./base";
import { BitcoinClass } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";

export class BitcoinCashClass extends BitcoinClass {
    public readonly name = "Bch";

    public readonly asset = "BCH";
    public readonly utils = {
        // ...super.utils,
        p2shPrefix: super.utils.p2shPrefix,
        getUTXO: BCHHandler.getUTXO,
        getUTXOs: BCHHandler.getUTXOs,
        getTransactions: BCHHandler.getTransactions,
        createAddress: createAddress(
            Networks,
            Opcode,
            Script,
            (bytes: Buffer) => toCashAddress(base58.encode(bytes))
        ),
        calculatePubKeyScript: pubKeyScript(Networks, Opcode, Script),
        addressIsValid: (address: Address, network: BitcoinNetwork) =>
            validate(address, this.asset.toLowerCase(), network),
    };
}

export type BitcoinCash = BitcoinCashClass;
export const BitcoinCash = Callable(BitcoinCashClass);
