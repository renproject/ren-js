import { Callable } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib-dogecoin";
import base58 from "bs58";
import { DOGEHandler } from "send-crypto/build/main/handlers/DOGE/DOGEHandler";
import { validate } from "wallet-address-validator";

import { Address, BitcoinNetwork } from "./base";
import { BitcoinClass } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";

export class DogecoinClass extends BitcoinClass {
    public name = "Doge";

    public asset = "DOGE";
    public utils = {
        getUTXO: DOGEHandler.getUTXO,
        getUTXOs: DOGEHandler.getUTXOs,
        getTransactions: DOGEHandler.getTransactions,
        p2shPrefix: {
            mainnet: Buffer.from([0x16]),
            testnet: Buffer.from([0xc4]),
        },
        createAddress: createAddress(Networks, Opcode, Script, base58.encode),
        calculatePubKeyScript: pubKeyScript(Networks, Opcode, Script),
        addressIsValid: (address: Address, network: BitcoinNetwork) =>
            validate(address, this.asset.toLowerCase(), network),
    };
}

export type Dogecoin = DogecoinClass;
export const Dogecoin = Callable(DogecoinClass);
