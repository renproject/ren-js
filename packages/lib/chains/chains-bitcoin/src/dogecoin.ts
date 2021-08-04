import {
    ChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import { Callable, isHex, utilsWithChainNetwork } from "@renproject/utils";
import base58 from "bs58";
import { Blockchair, BlockchairNetwork } from "./APIs/blockchair";
import { SoChain, SoChainNetwork } from "./APIs/sochain";

import { BtcAddress, BtcNetwork, BtcTransaction } from "./base";
import { BitcoinClass } from "./bitcoin";
import { validateAddress } from "./utils";

export class DogecoinClass extends BitcoinClass {
    public static chain = "Dogecoin";
    public chain = DogecoinClass.chain;
    public name = DogecoinClass.chain;
    public legacyName = undefined;

    // APIs
    public withDefaultAPIs = (network: BtcNetwork): this => {
        switch (network) {
            case "mainnet":
                // prettier-ignore
                return this
                    .withAPI(Blockchair(BlockchairNetwork.DOGECOIN))
                    .withAPI(SoChain(SoChainNetwork.DOGE), { priority: 15 });
            case "testnet":
                // prettier-ignore
                return this
                    .withAPI(SoChain(SoChainNetwork.DOGETEST), { priority: 15 });
            case "regtest":
                throw new Error(`Regtest is currently not supported.`);
        }
    };

    public static asset = "DOGE";
    public asset = "DOGE";
    public static utils = {
        resolveChainNetwork: BitcoinClass.utils.resolveChainNetwork,
        p2shPrefix: {
            mainnet: Buffer.from([0x16]),
            testnet: Buffer.from([0xc4]),
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
                DogecoinClass.asset,
                Dogecoin.utils.resolveChainNetwork(network),
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
            switch (Dogecoin.utils.resolveChainNetwork(network)) {
                case "mainnet":
                    return `https://sochain.com/address/DOGE/${address}/`;
                case "testnet":
                    return `https://sochain.com/address/DOGETEST/${address}/`;
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

            switch (Dogecoin.utils.resolveChainNetwork(network)) {
                case "mainnet":
                    return `https://sochain.com/tx/DOGE/${txHash}/`;
                case "testnet":
                    return `https://sochain.com/tx/DOGETEST/${txHash}/`;
                case "regtest":
                    return undefined;
            }
        },
    };

    public utils = utilsWithChainNetwork(
        DogecoinClass.utils,
        () => this.chainNetwork,
    );
}

export type Dogecoin = DogecoinClass;
export const Dogecoin = Callable(DogecoinClass);

const _: ChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = Dogecoin;
