import { MintChainStatic } from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib-dogecoin";
import base58 from "bs58";
import { DOGEHandler } from "send-crypto/build/main/handlers/DOGE/DOGEHandler";

import { BtcAddress, BtcNetwork, BtcTransaction } from "./base";
import { BitcoinClass } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";
import { validateAddress } from "./utils";

export class DogecoinClass extends BitcoinClass {
    public static chain = "Dogecoin";
    public chain = DogecoinClass.chain;
    public name = DogecoinClass.chain;
    public legacyName = undefined;

    public static asset = "DOGE";
    public asset = "DOGE";
    public static utils = {
        getUTXO: DOGEHandler.getUTXO,
        getUTXOs: DOGEHandler.getUTXOs,
        getTransactions: DOGEHandler.getTransactions,
        p2shPrefix: {
            mainnet: Buffer.from([0x16]),
            testnet: Buffer.from([0xc4]),
        },
        createAddress: createAddress(Networks, Opcode, Script, base58.encode),
        calculatePubKeyScript: pubKeyScript(Networks, Opcode, Script),
        addressIsValid: (
            address: BtcAddress,
            network: BtcNetwork = "mainnet",
        ) => validateAddress(address, DogecoinClass.asset, network),

        addressExplorerLink: (
            address: BtcAddress,
            network: BtcNetwork = "mainnet",
        ): string | undefined => {
            if (network === "mainnet") {
                return `https://sochain.com/address/DOGE/${address}/`;
            } else if (network === "testnet") {
                return `https://sochain.com/address/DOGETEST/${address}/`;
            }
            return undefined;
        },

        transactionExplorerLink: (
            tx: BtcTransaction,
            network: BtcNetwork = "mainnet",
        ): string | undefined => {
            if (network === "mainnet") {
                return `https://sochain.com/tx/DOGE/${tx.txHash}/`;
            } else if (network === "testnet") {
                return `https://sochain.com/tx/DOGETEST/${tx.txHash}/`;
            }
            return undefined;
        },
    };

    public utils = utilsWithChainNetwork(
        DogecoinClass.utils,
        () => this.chainNetwork,
    );
}

export type Dogecoin = DogecoinClass;
export const Dogecoin = Callable(DogecoinClass);

const _: MintChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = Dogecoin;
