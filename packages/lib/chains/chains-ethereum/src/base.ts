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
    EventEmitterTyped,
} from "@renproject/interfaces";
import {
    assertType,
    fromHex,
    Ox,
    payloadToABI,
    utilsWithChainNetwork,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import * as ethers from "ethers";
import {
    JsonRpcFetchFunc,
    Web3Provider,
    ExternalProvider,
} from "@ethersproject/providers";

import { EthereumConfig, renDevnet, renMainnet, renTestnet } from "./networks";
import { EthAddress, EthProvider, EthTransaction } from "./types";
import {
    addressIsValid,
    transactionIsValid,
    extractBurnDetails,
    findBurnByNonce,
    findMintBySigHash,
    getGatewayAddress,
    getTokenAddress,
    submitToEthereum,
    EthereumTransactionConfig,
} from "./utils";

export const EthereumConfigMap = {
    [RenNetwork.Mainnet]: renMainnet,
    [RenNetwork.Testnet]: renTestnet,
    [RenNetwork.Devnet]: renDevnet,
};

const isEthereumConfig = (
    renNetwork:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | EthereumConfig,
): renNetwork is EthereumConfig => {
    return !!(renNetwork as EthereumConfig).addresses;
};

const resolveNetwork = (
    renNetwork?:
        | RenNetwork
        | RenNetworkString
        | RenNetworkDetails
        | EthereumConfig,
): EthereumConfig => {
    if (!renNetwork) {
        return EthereumConfigMap[RenNetwork.Mainnet];
    }
    let networkConfig: EthereumConfig | undefined;
    if (renNetwork && isEthereumConfig(renNetwork)) {
        networkConfig = renNetwork;
    } else if (renNetwork) {
        const networkDetails = getRenNetworkDetails(renNetwork);
        if (EthereumConfigMap[networkDetails.name]) {
            networkConfig = EthereumConfigMap[networkDetails.name];
        }
    }

    if (!networkConfig) {
        throw new Error(
            `Unrecognized network ${
                typeof renNetwork === "string" ? renNetwork : renNetwork.name
            }.`,
        );
    }

    return networkConfig;
};

export type NetworkInput =
    | RenNetwork
    | RenNetworkString
    | RenNetworkDetails
    | EthereumConfig;

export class EthereumBaseChain
    implements MintChain<EthTransaction, EthAddress, EthereumConfig>
{
    public static chain = "Ethereum";
    public chain = EthereumBaseChain.chain;
    public name = EthereumBaseChain.chain;
    public legacyName: MintChain["legacyName"] = "Eth";
    public logRequestLimit: number | undefined = undefined;
    private logger: Logger | undefined;

    public static configMap: {
        [network in RenNetwork]?: EthereumConfig;
    } = EthereumConfigMap;
    public configMap: {
        [network in RenNetwork]?: EthereumConfig;
    } = EthereumConfigMap;

    public static utils = {
        resolveChainNetwork: resolveNetwork,
        addressIsValid,
        transactionIsValid,
        addressExplorerLink: (
            address: EthAddress,
            network?: NetworkInput,
        ): string =>
            `${
                (
                    EthereumBaseChain.utils.resolveChainNetwork(network) ||
                    renMainnet
                ).etherscan
            }/address/${address}`,

        transactionExplorerLink: (
            transaction: EthTransaction,
            network?: NetworkInput,
        ): string =>
            `${
                (
                    EthereumBaseChain.utils.resolveChainNetwork(network) ||
                    renMainnet
                ).etherscan
            }/tx/${transaction || ""}`,
    };

    public utils = utilsWithChainNetwork(
        EthereumBaseChain.utils,
        () => this.renNetworkDetails,
    );

    public provider: Web3Provider | undefined;
    public signer: ethers.Signer | undefined;
    public renNetworkDetails: EthereumConfig | undefined;

    public readonly getTokenContractAddress = async (asset: string) => {
        if (!this.provider || !this.renNetworkDetails) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        return getTokenAddress(this.renNetworkDetails, this.provider, asset);
    };
    public readonly getGatewayContractAddress = async (token: string) => {
        if (!this.provider || !this.renNetworkDetails) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }

        const gatewayAddress = await getGatewayAddress(
            this.renNetworkDetails,
            this.provider,
            token,
        );

        if (gatewayAddress === "0x0000000000000000000000000000000000000000") {
            throw new Error(`Asset not supported on mint-chain.`);
        }

        return gatewayAddress;
    };

    constructor(
        web3Provider: EthProvider,
        renNetwork?:
            | RenNetwork
            | RenNetworkString
            | RenNetworkDetails
            | EthereumConfig,
        config: {
            logger?: Logger;
        } = {},
    ) {
        if (web3Provider) {
            /* eslint-disable @typescript-eslint/no-explicit-any */
            if (
                (web3Provider as any).signer &&
                (web3Provider as any).provider
            ) {
                this.provider = (web3Provider as any).provider;
                this.signer = (web3Provider as any).signer;
            } else {
                const provider = (web3Provider as any)._isProvider
                    ? (web3Provider as any)
                    : new ethers.providers.Web3Provider(
                          web3Provider as ExternalProvider | JsonRpcFetchFunc,
                      );
                this.provider = provider;
                this.signer = provider.getSigner();
            }
        }
        if (renNetwork) {
            this.renNetworkDetails = resolveNetwork(renNetwork);
        }
        this.logger = config.logger;
    }

    public withProvider = (web3Provider: EthProvider) => {
        if ((web3Provider as any).signer && (web3Provider as any).provider) {
            this.provider = (web3Provider as any).provider;
            this.signer = (web3Provider as any).signer;
        } else {
            const provider = (web3Provider as any)._isProvider
                ? (web3Provider as any)
                : new ethers.providers.Web3Provider(
                      web3Provider as ExternalProvider | JsonRpcFetchFunc,
                  );
            this.provider = provider;
            this.signer = provider.getSigner();
        }
        return this;
    };

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

        if (!this.provider || !this.renNetworkDetails) {
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
    assetDecimals = async (asset: string): Promise<number> => {
        if (!this.provider) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        if (asset === "ETH") {
            return 18;
        }
        const tokenAddress = await this.getTokenContractAddress(asset);

        const decimalsABI: AbiItem = {
            constant: true,
            inputs: [],
            name: "decimals",
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

        const tokenContract = new ethers.Contract(
            tokenAddress,
            [decimalsABI],
            this.provider,
        );

        const decimalsRaw = await await tokenContract.decimals();
        return new BigNumber(decimalsRaw).toNumber();
    };

    transactionID = (transaction: EthTransaction): string => {
        return transaction || "";
    };

    transactionIDFromRPCFormat = (txid: string | Buffer, txindex: string) =>
        this.transactionID(this.transactionFromRPCFormat(txid, txindex));

    transactionFromRPCFormat = (txid: string | Buffer, _txindex: string) =>
        Ox(txid);
    /**
     * @deprecated Renamed to `transactionFromRPCFormat`.
     * Will be removed in 3.0.0.
     */
    transactionFromID = this.transactionFromRPCFormat;

    transactionConfidence = async (
        transaction: EthTransaction,
    ): Promise<{ current: number; target: number }> => {
        if (!this.provider || !this.renNetworkDetails) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        if (transaction === null) {
            throw new Error(
                `Unable to fetch transaction confidence, transaction hash is 'null'.`,
            );
        }
        const currentBlock = new BigNumber(
            (await this.provider.getBlockNumber()).toString(),
        );
        const receipt = await this.provider.getTransactionReceipt(transaction);
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
        eventEmitter: EventEmitterTyped<{
            transactionHash: [string];
            confirmation: [number, { status: number }];
        }>,
    ): Promise<EthTransaction> => {
        if (!mintTx.out) {
            throw new Error(`No signature passed to mint submission.`);
        }

        if (mintTx.out.revert !== undefined) {
            throw new Error(`Unable to submit reverted RenVM transaction.`);
        }

        if (!this.provider || !this.signer) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }

        const existingTransaction = await this.findMint(
            asset,
            mintTx.out.nhash,
            mintTx.out.sighash,
        );
        if (existingTransaction === "") {
            return "";
        } else if (existingTransaction) {
            eventEmitter.emit("transactionHash", existingTransaction);
            eventEmitter.emit("confirmation", 1, { status: 1 });
            return existingTransaction;
        }

        return await submitToEthereum(
            this.signer,
            contractCalls,
            mintTx,
            eventEmitter,
        );
    };

    findMint = async (
        asset: string,
        nHash: Buffer,
        sigHash?: Buffer,
    ): Promise<EthTransaction | undefined> => {
        if (!this.renNetworkDetails || !this.provider) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        return findMintBySigHash(
            this.renNetworkDetails,
            this.provider,
            asset,
            nHash,
            sigHash,
            this.logRequestLimit,
        );
    };

    resolveTokenGatewayContract = async (asset: string): Promise<string> => {
        if (!this.renNetworkDetails || !this.provider) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        return Ox(
            await getTokenAddress(this.renNetworkDetails, this.provider, asset),
        );
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    submitBurn = async (
        _asset: string,
        eventEmitter: EventEmitterTyped<{
            transactionHash: [string];
        }>,
        contractCalls: ContractCall[],
        config: { networkDelay?: number } = {},
    ): Promise<BurnDetails<EthTransaction>> => {
        if (!this.renNetworkDetails || !this.provider) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        // Make a call to the provided contract and Pass on the
        // transaction hash.
        let transaction: EthTransaction | undefined;
        for (let i = 0; i < contractCalls.length; i++) {
            const contractCall = contractCalls[i];
            const last = i === contractCalls.length - 1;
            const { contractParams, contractFn, sendTo } = contractCall;
            const callParams = [
                ...(contractParams || []).map((value) => value.value),
            ];
            const ABI = payloadToABI(contractFn, contractParams);
            const contract = new ethers.Contract(sendTo, ABI, this.signer);

            let txConfig =
                typeof contractCall === "object"
                    ? (contractCall.txConfig as EthereumTransactionConfig)
                    : {};

            txConfig = {
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
            };
            if (this.logger) {
                this.logger.debug(
                    "Calling Ethereum contract",
                    contractFn,
                    sendTo,
                    ...callParams,
                    txConfig,
                );
            }
            const tx = await contract[contractFn](...callParams, txConfig);
            if (last) {
                eventEmitter.emit("transactionHash", tx.hash);
            }
            const receipt = await tx.wait();

            transaction = receipt.transactionHash;
            if (this.logger) {
                this.logger.debug("Transaction hash", transaction);
            }
        }

        if (!transaction) {
            throw new Error(`Unable to find burn from provided parameters.`);
        }

        return extractBurnDetails(
            this.provider,
            transaction,
            this.logger,
            config.networkDelay,
        );
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    findBurn = async (
        asset: string,
        eventEmitter: EventEmitterTyped<{
            transactionHash: [string];
        }>,
        // Once of the following should not be undefined.
        transaction?: EthTransaction,
        burnNonce?: Buffer | string | number,
        config: { networkDelay?: number } = {},
    ): Promise<BurnDetails<EthTransaction> | undefined> => {
        if (!this.renNetworkDetails || !this.provider) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }

        if (!transaction && burnNonce) {
            return findBurnByNonce(
                this.renNetworkDetails,
                this.provider,
                asset,
                burnNonce.toString(),
            );
        }

        if (!transaction) {
            return undefined;
        }

        eventEmitter.emit("transactionHash", transaction);

        return extractBurnDetails(
            this.provider,
            transaction,
            this.logger,
            config.networkDelay,
        );
    };

    getFees = async (
        asset: string,
    ): Promise<{
        burn: number;
        mint: number;
    }> => {
        if (!this.provider) {
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

        const gatewayContract = new ethers.Contract(
            gatewayAddress,
            [mintFeeABI, burnFeeABI],
            this.provider,
        );
        const mintFee = await gatewayContract.mintFee();
        const burnFee = await gatewayContract.burnFee();

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

        if (!this.provider) {
            throw new Error(
                `${this.name} object not initialized - must provide network to constructor.`,
            );
        }
        const tokenAddress = await this.getTokenContractAddress(asset);

        const tokenContract = new ethers.Contract(
            tokenAddress,
            [balanceOfABI],
            this.provider,
        );

        const balanceRaw = await await tokenContract.balanceOf(address);

        return new BigNumber(balanceRaw.toString());
    };

    transactionRPCFormat = (transaction: EthTransaction, _v2?: boolean) => {
        assertType<string | null>("string | null", { transaction });

        if (transaction === null) {
            throw new Error(
                `Unable to encode transaction, transaction hash is 'null'.`,
            );
        }

        return {
            txid: fromHex(transaction),
            txindex: "0",
        };
    };

    transactionRPCTxidFromID = (transactionID: string): Buffer =>
        fromHex(transactionID);
}

const _: ChainStatic<EthTransaction, EthAddress, EthereumConfig> =
    EthereumBaseChain;
