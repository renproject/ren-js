import { MintChainStatic } from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib-zcash";
import base58 from "bs58";
import { ZECHandler } from "send-crypto/build/main/handlers/ZEC/ZECHandler";

import { BtcAddress, BtcNetwork, BtcTransaction } from "./base";
import { BitcoinClass } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";
import { validateAddress } from "./utils";

export class ZcashClass extends BitcoinClass {
    public static chain = "Zcash";
    public chain = ZcashClass.chain;
    public name = ZcashClass.chain;
    public legacyName = "Zec";

    public static asset = "ZEC";
    public asset = "ZEC";
    public static utils = {
        p2shPrefix: {
            mainnet: Buffer.from([0x1c, 0xbd]),
            testnet: Buffer.from([0x1c, 0xba]),
        },
        getUTXO: ZECHandler.getUTXO,
        getUTXOs: ZECHandler.getUTXOs,
        getTransactions: ZECHandler.getTransactions,
        createAddress: createAddress(Networks, Opcode, Script, base58.encode),
        calculatePubKeyScript: pubKeyScript(Networks, Opcode, Script),
        addressIsValid: (
            address: BtcAddress,
            network: BtcNetwork = "mainnet",
        ) => validateAddress(address, ZcashClass.asset, network),
        addressExplorerLink: (
            address: BtcAddress,
            network: BtcNetwork = "mainnet",
        ): string | undefined => {
            if (network === "mainnet") {
                return `https://sochain.com/address/ZEC/${address}/`;
            } else if (network === "testnet") {
                return `https://sochain.com/address/ZECTEST/${address}/`;
            }
            return undefined;
        },

        transactionExplorerLink: (
            tx: BtcTransaction,
            network: BtcNetwork = "mainnet",
        ): string | undefined => {
            if (network === "mainnet") {
                return `https://sochain.com/tx/ZEC/${tx.txHash}/`;
            } else if (network === "testnet") {
                return `https://sochain.com/tx/ZECTEST/${tx.txHash}/`;
            }
            return undefined;
        },
    };

    public utils = utilsWithChainNetwork(Zcash.utils, () => this.chainNetwork);
}

export type Zcash = ZcashClass;
export const Zcash = Callable(ZcashClass);

const _: MintChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = Zcash;
