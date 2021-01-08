import { MintChainStatic } from "@renproject/interfaces";
import { Callable, utilsWithChainNetwork } from "@renproject/utils";
import { Networks, Opcode, Script } from "bitcore-lib-dogecoin";
import base58 from "bs58";
import { Blockchair, BlockchairNetwork } from "./APIs/blockchair";
import { SoChain, SoChainNetwork } from "./APIs/sochain";

import { BtcAddress, BtcNetwork, BtcTransaction } from "./base";
import { BitcoinClass } from "./bitcoin";
import { createAddress, pubKeyScript } from "./script";
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
        p2shPrefix: {
            mainnet: Buffer.from([0x16]),
            testnet: Buffer.from([0xc4]),
        },
        createAddress: createAddress(Networks, Opcode, Script, base58.encode),
        calculatePubKeyScript: pubKeyScript(Networks, Opcode, Script),
        addressIsValid: (
            address: BtcAddress | string,
            network: BtcNetwork = "mainnet",
        ) => validateAddress(address, DogecoinClass.asset, network),

        addressExplorerLink: (
            address: BtcAddress | string,
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
            tx: BtcTransaction | string,
            network: BtcNetwork = "mainnet",
        ): string | undefined => {
            const txHash = typeof tx === "string" ? tx : tx.txHash;

            if (network === "mainnet") {
                return `https://sochain.com/tx/DOGE/${txHash}/`;
            } else if (network === "testnet") {
                return `https://sochain.com/tx/DOGETEST/${txHash}/`;
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
