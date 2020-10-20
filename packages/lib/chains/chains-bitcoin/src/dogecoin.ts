import { Callable } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib-dogecoin";
import base58 from "bs58";
import { DOGEHandler } from "send-crypto/build/main/handlers/DOGE/DOGEHandler";
import { validate } from "wallet-address-validator";

import { Address, BitcoinNetwork, Transaction } from "./base";
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

    addressExplorerLink = (address: Address): string | undefined => {
        if (this.chainNetwork === "mainnet") {
            return `https://sochain.com/address/DOGE/${address}/`;
        } else if (this.chainNetwork === "testnet") {
            return `https://sochain.com/address/DOGETEST/${address}/`;
        }
        return undefined;
    };

    transactionExplorerLink = (tx: Transaction): string | undefined => {
        if (this.chainNetwork === "mainnet") {
            return `https://sochain.com/tx/DOGE/${tx.txHash}/`;
        } else if (this.chainNetwork === "testnet") {
            return `https://sochain.com/tx/DOGETEST/${tx.txHash}/`;
        }
        return undefined;
    };
}

export type Dogecoin = DogecoinClass;
export const Dogecoin = Callable(DogecoinClass);
