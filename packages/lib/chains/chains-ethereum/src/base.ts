import {
    AbiItem,
    BurnDetails,
    ContractCall,
    getRenNetworkDetails,
    LockAndMintTransaction,
    Logger,
    MintChain,
    ChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
} from "@renproject/interfaces";
import {
    assertType,
    extractError,
    fromHex,
    Ox,
    payloadToABI,
    utilsWithChainNetwork,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { EventEmitter } from "events";
import Web3 from "web3";
import { TransactionConfig } from "web3-core";
import { provider } from "web3-providers";

import {
    EthereumConfig,
    renDevnetVDot3,
    renMainnet,
    renMainnetVDot3,
    renTestnet,
    renTestnetVDot3,
} from "./networks";
import {
    addressIsValid,
    extractBurnDetails,
    findBurnByNonce,
    findTransactionBySigHash,
    forwardWeb3Events,
    getGatewayAddress,
    getTokenAddress,
    ignorePromiEventError,
    manualPromiEvent,
    submitToEthereum,
    withDefaultAccount,
} from "./utils";

export const EthereumConfigMap = {
    [RenNetwork.Mainnet]: renMainnet,
    [RenNetwork.Testnet]: renTestnet,
    [RenNetwork.MainnetVDot3]: renMainnetVDot3,
    [RenNetwork.TestnetVDot3]: renTestnetVDot3,
    [RenNetwork.DevnetVDot3]: renDevnetVDot3,
};

export type EthTransaction = string;
export type EthAddress = string;

const resolveNetwork = (
    renNetwork:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | EthereumConfig,
): EthereumConfig => {
    let networkConfig: EthereumConfig | undefined;
    if (renNetwork && (renNetwork as EthereumConfig).addresses) {
        networkConfig = renNetwork as EthereumConfig;
    } else if (renNetwork) {
        const networkDetails = getRenNetworkDetails(
            renNetwork as RenNetwork | RenNetworkString | RenNetworkDetails,
        );
        if (EthereumConfigMap[networkDetails.name]) {
            networkConfig = EthereumConfigMap[networkDetails.name];
        }
    }

    if (!networkConfig) {
        throw new Error(`Unrecognized network ${renNetwork}.`);
    }

    return networkConfig;
};

export type NetworkInput =
    | RenNetwork
    | RenNetworkString
    | RenNetworkDetails
    | EthereumConfig;

export class EthereumBaseChain
    implements MintChain<EthTransaction, EthAddress, EthereumConfig> {
    public static chain = "Ethereum";
    public chain = EthereumBaseChain.chain;
    public name = EthereumBaseChain.chain;
    public legacyName: MintChain["legacyName"] = "Eth";

    public static utils = {
        resolveChainNetwork: resolveNetwork,
        addressIsValid,
        addressExplorerLink: (
            address: EthAddress,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | NetworkInput = renMainnet,
        ): string =>
            `${
                (
                    EthereumBaseChain.utils.resolveChainNetwork(network) ||
                    renMainnet
                ).etherscan
            }/address/${address}`,

        transactionExplorerLink: (
            transaction: EthTransaction,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | NetworkInput = renMainnet,
        ): string =>
            `${
                (
                    EthereumBaseChain.utils.resolveChainNetwork(network) ||
                    renMainnet
                ).etherscan
            }/tx/${transaction}`,
    };

    public utils = utilsWithChainNetwork(
        EthereumBaseChain.utils,
        () => this.renNetworkDetails,
    );

    public readonly web3: Web3 | undefined;
    public renNetworkDetails: EthereumConfig | undefined;

    public readonly getTokenContractAddress = async (asset: string) => {
        if (!this.web3 || !this.renNetworkDetails) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        return getTokenAddress(this.renNetworkDetails, this.web3, asset);
    };
    public readonly getGatewayContractAddress = async (token: string) => {
        if (!this.web3 || !this.renNetworkDetails) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }

        const gatewayAddress = await getGatewayAddress(
            this.renNetworkDetails,
            this.web3,
            token,
        );

        if (gatewayAddress === "0x0000000000000000000000000000000000000000") {
            throw new Error(`Asset not supported on mint-chain.`);
        }

        return gatewayAddress;
    };

    constructor(
        web3Provider: provider,
        renNetwork?:
            | RenNetwork
            | RenNetworkString
            | RenNetworkDetails
            | EthereumConfig,
    ) {
        this.web3 = new Web3(web3Provider);
        if (renNetwork) {
            this.renNetworkDetails = resolveNetwork(renNetwork);
        }
    }

    /**
     * See [LockChain.initialize].
     */
    initialize = (
        renNetwork: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => {
        this.renNetworkDetails =
            this.renNetworkDetails ||
            EthereumConfigMap[getRenNetworkDetails(renNetwork).name];

        if (!this.renNetworkDetails) {
            throw new Error(
                `Unable to set ${this.name} network for RenVM network ${
                    getRenNetworkDetails(renNetwork).name
                }. Please provide ${this.name} network details to ${
                    this.name
                } constructor.`,
            );
        }
        return this;
    };

    // Supported assets

    assetIsNative = (asset: string): boolean => {
        return asset === "ETH";
    };

    /**
     * `assetIsSupported` should return true if the asset is native to the
     * MintChain.
     *
     * ```ts
     * ethereum.assetIsSupported = asset => asset === "ETH";
     * ```
     */
    assetIsSupported = async (asset: string): Promise<boolean> => {
        if (this.assetIsNative(asset)) {
            return true;
        }

        if (!this.web3 || !this.renNetworkDetails) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }

        // Check that there's a gateway contract for the asset.
        try {
            return !!(await this.getGatewayContractAddress(asset));
        } catch (error) {
            if (
                /(Empty address returned)|(Asset not supported on mint-chain)/.exec(
                    String((error || {}).message),
                )
            ) {
                // Ignore
            } else {
                console.warn(error);
            }
            return false;
        }
    };

    /**
     * `assetDecimals` should return the number of decimals of the asset.
     *
     * If the asset is not supported, an error should be thrown.
     *
     
     */
    assetDecimals = (asset: string): number => {
        if (asset === "ETH") {
            return 18;
        }
        throw new Error(`Unsupported asset ${asset}.`);
    };

    transactionID = (transaction: EthTransaction): string => {
        return transaction;
    };

    transactionFromID = (txid: string | Buffer, _txindex: string) => Ox(txid);

    transactionConfidence = async (
        transaction: EthTransaction,
    ): Promise<{ current: number; target: number }> => {
        if (!this.web3 || !this.renNetworkDetails) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        const currentBlock = new BigNumber(
            (await this.web3.eth.getBlockNumber()).toString(),
        );
        const receipt = await this.web3.eth.getTransactionReceipt(transaction);
        let current = 0;
        if (receipt.blockNumber) {
            const transactionBlock = new BigNumber(
                receipt.blockNumber.toString(),
            );
            current = currentBlock.minus(transactionBlock).plus(1).toNumber();
        }
        return {
            current,
            target: this.renNetworkDetails.isTestnet ? 15 : 30,
        };
    };

    submitMint = async (
        asset: string,
        contractCalls: ContractCall[],
        mintTx: LockAndMintTransaction,
        eventEmitter: EventEmitter,
    ): Promise<EthTransaction> => {
        if (!mintTx.out) {
            throw new Error(`No signature passed to mint submission.`);
        }

        if (mintTx.out.revert !== undefined) {
            throw new Error(`Unable to submit reverted RenVM transaction.`);
        }

        if (!this.web3) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }

        const existingTransaction = await this.findTransaction(
            asset,
            mintTx.out.nhash,
            mintTx.out.sighash,
        );
        if (existingTransaction) {
            await manualPromiEvent(
                this.web3,
                existingTransaction,
                eventEmitter,
            );
            return existingTransaction;
        }

        return await submitToEthereum(
            this.web3,
            contractCalls,
            mintTx,
            eventEmitter,
        );
    };

    findTransaction = async (
        asset: string,
        nHash: Buffer,
        sigHash?: Buffer,
    ): Promise<EthTransaction | undefined> => {
        if (!this.renNetworkDetails || !this.web3) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        return findTransactionBySigHash(
            this.renNetworkDetails,
            this.web3,
            asset,
            nHash,
            sigHash,
        );
    };

    resolveTokenGatewayContract = async (asset: string): Promise<string> => {
        if (!this.renNetworkDetails || !this.web3) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        return Ox(
            await getTokenAddress(this.renNetworkDetails, this.web3, asset),
        );
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    findBurnTransaction = async (
        asset: string,
        // Once of the following should not be undefined.
        burn: {
            transaction?: EthTransaction;
            burnNonce?: Buffer | string | number;
            contractCalls?: ContractCall[];
        },

        eventEmitter: EventEmitter,
        logger: Logger,
    ): Promise<BurnDetails<EthTransaction>> => {
        if (!this.renNetworkDetails || !this.web3) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }

        const { burnNonce, contractCalls } = burn;
        let { transaction } = burn;

        if (burnNonce) {
            return findBurnByNonce(
                this.renNetworkDetails,
                this.web3,
                asset,
                burnNonce.toString(),
            );
        }

        // There are three parameter configs:
        // Situation (1): A `burnNonce` is provided
        // Situation (2): Contract call details are provided
        // Situation (3): A transaction is provided

        // Handle situation (2)
        // Make a call to the provided contract and Pass on the
        // transaction hash.
        if (!transaction && contractCalls) {
            for (let i = 0; i < contractCalls.length; i++) {
                const contractCall = contractCalls[i];
                const last = i === contractCalls.length - 1;
                const { contractParams, contractFn, sendTo } = contractCall;
                const callParams = [
                    ...(contractParams || []).map((value) => value.value),
                ];
                const ABI = payloadToABI(contractFn, contractParams);
                const contract = new this.web3.eth.Contract(ABI, sendTo);

                const txConfig =
                    typeof contractCall === "object"
                        ? (contractCall.txConfig as TransactionConfig)
                        : {};

                const config = await withDefaultAccount(this.web3, {
                    ...txConfig,
                    ...{
                        value:
                            txConfig && txConfig.value
                                ? txConfig.value.toString()
                                : undefined,
                        gasPrice:
                            txConfig && txConfig.gasPrice
                                ? txConfig.gasPrice.toString()
                                : undefined,
                    },
                });
                logger.debug(
                    "Calling Ethereum contract",
                    contractFn,
                    sendTo,
                    ...callParams,
                    config,
                );
                const tx = contract.methods[contractFn](...callParams).send(
                    config,
                );
                if (last) {
                    forwardWeb3Events(tx, eventEmitter);
                }
                transaction = await new Promise<string>((resolve, reject) =>
                    tx.on("transactionHash", resolve).catch((error: Error) => {
                        try {
                            if (ignorePromiEventError(error)) {
                                logger.error(extractError(error));
                                return;
                            }
                        } catch (_error) {
                            /* Ignore _error */
                        }
                        reject(error);
                    }),
                );
                logger.debug("Transaction hash", transaction);
            }
        }

        if (!transaction) {
            throw new Error(`Unable to find burn from provided parameters.`);
        }

        return extractBurnDetails(this.web3, transaction, logger);
    };

    getFees = async (
        asset: string,
    ): Promise<{
        burn: number;
        mint: number;
    }> => {
        if (!this.web3) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        const gatewayAddress = await this.getGatewayContractAddress(asset);

        const mintFeeABI: AbiItem = {
            constant: true,
            inputs: [],
            name: "mintFee",
            outputs: [
                {
                    internalType: "uint16",
                    name: "",
                    type: "uint16",
                },
            ],
            payable: false,
            stateMutability: "view",
            type: "function",
        };

        const burnFeeABI: AbiItem = {
            constant: true,
            inputs: [],
            name: "burnFee",
            outputs: [
                {
                    internalType: "uint16",
                    name: "",
                    type: "uint16",
                },
            ],
            payable: false,
            stateMutability: "view",
            type: "function",
        };

        const gatewayContract = new this.web3.eth.Contract(
            [mintFeeABI, burnFeeABI],
            gatewayAddress,
        );
        const mintFee = await gatewayContract.methods.mintFee().call();
        const burnFee = await gatewayContract.methods.burnFee().call();

        return {
            mint: new BigNumber(mintFee.toString()).toNumber(),
            burn: new BigNumber(burnFee.toString()).toNumber(),
        };
    };

    public getBalance = async (
        asset: string,
        address?: EthAddress,
    ): Promise<BigNumber> => {
        const balanceOfABI: AbiItem = {
            constant: true,
            inputs: [
                {
                    internalType: "address",
                    name: "account",
                    type: "address",
                },
            ],
            name: "balanceOf",
            outputs: [
                {
                    internalType: "uint256",
                    name: "",
                    type: "uint256",
                },
            ],
            payable: false,
            stateMutability: "view",
            type: "function",
        };

        if (!this.web3) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        const tokenAddress = await this.getTokenContractAddress(asset);

        const tokenContract = new this.web3.eth.Contract(
            [balanceOfABI],
            tokenAddress,
        );

        const balanceRaw = await await tokenContract.methods
            .balanceOf(address)
            .call();

        return new BigNumber(balanceRaw.toString());
    };

    transactionRPCFormat = (transaction: EthTransaction, _v2?: boolean) => {
        assertType<string>("string", { transaction });

        return {
            txid: fromHex(transaction),
            txindex: "0",
        };
    };
}

const _: ChainStatic<
    EthTransaction,
    EthAddress,
    EthereumConfig
> = EthereumBaseChain;
