import {
    ChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable, isHex, utilsWithChainNetwork } from "@renproject/utils";
import base58 from "bs58";
import { Insight } from "./APIs/insight";
import { SoChain, SoChainNetwork } from "./APIs/sochain";

import { BtcAddress, BtcNetwork, BtcTransaction } from "./base";
import { BitcoinClass } from "./bitcoin";
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
        resolveChainNetwork: BitcoinClass.utils.resolveChainNetwork,
        p2shPrefix: {
            mainnet: Buffer.from([0x1c, 0xbd]),
            testnet: Buffer.from([0x1c, 0xba]),
        },
        addressBufferToString: base58.encode,
        addressIsValid: (
            address: BtcAddress | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ) =>
            validateAddress(
                address,
                ZcashClass.asset,
                Zcash.utils.resolveChainNetwork(network),
            ),

        transactionIsValid: (
            transaction: BtcTransaction | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ) =>
            isHex(
                typeof transaction === "string"
                    ? transaction
                    : transaction.txHash,
                { length: 32 },
            ),

        addressExplorerLink: (
            address: BtcAddress | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): string | undefined => {
            switch (Zcash.utils.resolveChainNetwork(network)) {
                case "mainnet":
                    return `https://sochain.com/address/ZEC/${address}/`;
                case "testnet":
                    return `https://sochain.com/address/ZECTEST/${address}/`;
                case "regtest":
                    return undefined;
            }
        },

        transactionExplorerLink: (
            tx: BtcTransaction | string,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): string | undefined => {
            const txHash = typeof tx === "string" ? tx : tx.txHash;

            switch (Zcash.utils.resolveChainNetwork(network)) {
                case "mainnet":
                    return `https://sochain.com/tx/ZEC/${txHash}/`;
                case "testnet":
                    return `https://sochain.com/tx/ZECTEST/${txHash}/`;
                case "regtest":
                    return undefined;
            }
        },
    };

    public utils = utilsWithChainNetwork(Zcash.utils, () => this.chainNetwork);
}

export type Zcash = ZcashClass;
export const Zcash = Callable(ZcashClass);

const _: ChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = Zcash;
