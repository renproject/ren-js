import { Callable } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib-zcash";
import base58 from "bs58";
import { ZECHandler } from "send-crypto/build/main/handlers/ZEC/ZECHandler";
import { validate } from "wallet-address-validator";

import { Address, BitcoinNetwork } from "./base";
import { BitcoinClass } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";

export class ZcashClass extends BitcoinClass {
    public name = "Zec";

    public asset = "ZEC";
    public utils = {
        p2shPrefix: {
            mainnet: Buffer.from([0x1c, 0xbd]),
            testnet: Buffer.from([0x1c, 0xba]),
        },
        getUTXO: ZECHandler.getUTXO,
        getUTXOs: ZECHandler.getUTXOs,
        getTransactions: ZECHandler.getTransactions,
        createAddress: createAddress(Networks, Opcode, Script, base58.encode),
        calculatePubKeyScript: pubKeyScript(Networks, Opcode, Script),
        addressIsValid: (address: Address, network: BitcoinNetwork) =>
            validate(address, "zec", network),
    };
}

export type Zcash = ZcashClass;
export const Zcash = Callable(ZcashClass);
