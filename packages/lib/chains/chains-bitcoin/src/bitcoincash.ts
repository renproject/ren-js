import { Callable } from "@renproject/utils";
import { toCashAddress } from "bchaddrjs";
import { Networks, Opcode, Script } from "bitcore-lib-cash";
import base58 from "bs58";
import { BCHHandler } from "send-crypto/build/main/handlers/BCH/BCHHandler";
import { validate } from "wallet-address-validator";

import { Address, BitcoinNetwork, Transaction } from "./base";
import { BitcoinClass } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";

export class BitcoinCashClass extends BitcoinClass {
    public readonly name = "BitcoinCash";
    public legacyName = "Bch";

    public readonly asset = "BCH";
    public readonly utils = {
        p2shPrefix: {
            mainnet: Buffer.from([0x05]),
            testnet: Buffer.from([0xc4]),
        },
        getUTXO: BCHHandler.getUTXO,
        getUTXOs: BCHHandler.getUTXOs,
        getTransactions: BCHHandler.getTransactions,
        createAddress: createAddress(
            Networks,
            Opcode,
            Script,
            (bytes: Buffer) => toCashAddress(base58.encode(bytes)),
        ),
        calculatePubKeyScript: pubKeyScript(Networks, Opcode, Script),
        addressIsValid: (address: Address, network: BitcoinNetwork) =>
            validate(address, this.asset.toLowerCase(), network),
    };

    addressExplorerLink = (address: Address): string | undefined => {
        if (this.chainNetwork === "mainnet") {
            return `https://explorer.bitcoin.com/bch/address/${address}`;
        } else if (this.chainNetwork === "testnet") {
            return `https://explorer.bitcoin.com/tbch/address/${address}`;
        }
        return undefined;
    };

    transactionExplorerLink = (tx: Transaction): string | undefined => {
        if (this.chainNetwork === "mainnet") {
            return `https://explorer.bitcoin.com/bch/tx/${tx.txHash}`;
        } else if (this.chainNetwork === "testnet") {
            return `https://explorer.bitcoin.com/tbch/tx/${tx.txHash}`;
        }
        return undefined;
    };
}

export type BitcoinCash = BitcoinCashClass;
export const BitcoinCash = Callable(BitcoinCashClass);
