import { MintChainStatic } from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib-zcash";
import base58 from "bs58";
import { Insight } from "./APIs/insight";
import { SoChain, SoChainNetwork } from "./APIs/sochain";

import { BtcAddress, BtcNetwork, BtcTransaction } from "./base";
import { BitcoinClass } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";
import { validateAddress } from "./utils";

enum InsightEndpoints {
    // Testnet
    TestnetZCash = "https://explorer.testnet.z.cash/api/",
    // Mainnet
    ZCash = "https://explorer.z.cash/api/",
    ZecBlockExplorer = "https://zecblockexplorer.com/api/",
    ZecChain = "https://zechain.net/api/v1/",
    BlockExplorer = "https://zcash.blockexplorer.com/api/",
}

export class ZcashClass extends BitcoinClass {
    public static chain = "Zcash";
    public chain = ZcashClass.chain;
    public name = ZcashClass.chain;
    public legacyName = "Zec";

    public withDefaultAPIs = (network: BtcNetwork): this => {
        switch (network) {
            case "mainnet":
                // prettier-ignore
                return this
                    .withAPI(Insight(InsightEndpoints.ZCash))
                    .withAPI(Insight(InsightEndpoints.ZecBlockExplorer))
                    .withAPI(Insight(InsightEndpoints.ZecChain))
                    .withAPI(Insight(InsightEndpoints.BlockExplorer))
                    .withAPI(SoChain(SoChainNetwork.ZEC), { priority: 15 });
            case "testnet":
                // prettier-ignore
                return this
                    .withAPI(Insight(InsightEndpoints.TestnetZCash))
                    .withAPI(SoChain(SoChainNetwork.ZECTEST), { priority: 15 });
            case "regtest":
                throw new Error(`Regtest is currently not supported.`);
        }
    };

    public static asset = "ZEC";
    public asset = "ZEC";
    public static utils = {
        p2shPrefix: {
            mainnet: Buffer.from([0x1c, 0xbd]),
            testnet: Buffer.from([0x1c, 0xba]),
        },
        createAddress: createAddress(Networks, Opcode, Script, base58.encode),
        calculatePubKeyScript: pubKeyScript(Networks, Opcode, Script),
        addressIsValid: (
            address: BtcAddress | string,
            network: BtcNetwork = "mainnet",
        ) => validateAddress(address, ZcashClass.asset, network),
        addressExplorerLink: (
            address: BtcAddress | string,
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
            tx: BtcTransaction | string,
            network: BtcNetwork = "mainnet",
        ): string | undefined => {
            const txHash = typeof tx === "string" ? tx : tx.txHash;

            if (network === "mainnet") {
                return `https://sochain.com/tx/ZEC/${txHash}/`;
            } else if (network === "testnet") {
                return `https://sochain.com/tx/ZECTEST/${txHash}/`;
            }
            return undefined;
        },
    };

    public utils = utilsWithChainNetwork(Zcash.utils, () => this.chainNetwork);
}

export type Zcash = ZcashClass;
export const Zcash = Callable(ZcashClass);

const _: MintChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = Zcash;
