import BigNumber from "bignumber.js";
import base58 from "bs58";

import {
    BitcoinClass,
    BtcAddress,
    BtcNetwork,
    BtcTransaction,
} from "@renproject/chains-bitcoin";
import { UTXO } from "@renproject/chains-bitcoin/build/main/APIs/API";
import { validateAddress } from "@renproject/chains-bitcoin/build/main/utils";
import {
    ChainStatic,
    isHex,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
    utilsWithChainNetwork,
} from "@renproject/utils";

import { randomBytes } from "./utils";

export class MockChain extends BitcoinClass {
    public static chain = "MockChain";
    public chain = MockChain.chain;
    public name = MockChain.chain;
    public mempool: Array<UTXO & { to: string }>;

    constructor(asset: string, network: BtcNetwork = "testnet") {
        super(network);
        this.mempool = [];
        this.asset = asset;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public fetchUTXO = async (txHash: string, vOut: number): Promise<UTXO> => {
        const utxo = this.mempool.find(
            (x) => x.txHash === txHash && x.vOut === vOut,
        );
        if (utxo) {
            return utxo;
        }
        throw new Error(`UTXO ${txHash}, ${vOut} not found`);
    };
    public fetchUTXOs = async (
        address: string,
        confirmations?: number,
        // eslint-disable-next-line @typescript-eslint/require-await
    ): Promise<UTXO[]> =>
        this.mempool.filter(
            (x) => x.to === address && x.confirmations >= (confirmations || 0),
        );

    public addUTXO = (to: string, amount: BigNumber | number): UTXO => {
        const tx = {
            to,
            txHash: randomBytes(32).toString("hex"),
            vOut: 0,
            amount: amount.toString(),
            confirmations: 0,
        };
        this.mempool.push(tx);
        return tx;
    };

    // APIs
    public withDefaultAPIs = (_network: BtcNetwork): this => this.withAPI(this);

    public static asset = "BTC";
    public asset = "BTC";
    public static utils = {
        resolveChainNetwork: BitcoinClass.utils.resolveChainNetwork,
        p2shPrefix: {
            mainnet: Buffer.from([0x05]),
            testnet: Buffer.from([0xc4]),
        },
        addressBufferToString: base58.encode as (bytes: Buffer) => string,
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
                MockChain.asset,
                MockChain.utils.resolveChainNetwork(network),
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
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): string | undefined => address,

        transactionExplorerLink: (
            tx: BtcTransaction | string,
            _network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | BtcNetwork = "mainnet",
        ): string | undefined => (typeof tx === "string" ? tx : tx.txHash),
    };

    public utils = utilsWithChainNetwork(
        MockChain.utils,
        () => this.chainNetwork,
    );
}

const _: ChainStatic<BtcTransaction, BtcAddress, BtcNetwork> = MockChain;
