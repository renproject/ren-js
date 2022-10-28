import {
    JsonRpcProvider,
    Provider,
    Web3Provider,
} from "@ethersproject/providers";
import {
    assertType,
    ChainTransaction,
    ContractChain,
    defaultLogger,
    DefaultTxWaiter,
    ErrorWithCode,
    InputChainTransaction,
    InputType,
    Logger,
    OutputType,
    populateChainTransaction,
    RenJSError,
    RenNetwork,
    TxSubmitter,
    TxWaiter,
    utils,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import elliptic from "elliptic";
import { errors, ethers } from "ethers";
import { computeAddress } from "ethers/lib/utils";

import {
    findABIMethod,
    getGatewayRegistryInstance,
    LockGatewayABI,
    MintGatewayABI,
    TransferWithLogABI,
} from "./contracts";
import { LogLockToChainEvent } from "./contracts/typechain/LockGatewayV3";
import {
    LogBurnEvent,
    LogBurnToChainEvent,
} from "./contracts/typechain/MintGatewayV3";
import { LogTransferredEvent } from "./contracts/typechain/TransferWithLog";
import { AbiItem, EthArg } from "./utils/abi";
import { EVMTxSubmitter } from "./utils/evmTxSubmitter";
import {
    getLockAsset,
    getLockGateway,
    getMintGateway,
    getRenAsset,
} from "./utils/gatewayRegistry";
import {
    checkProviderNetwork,
    filterLogs,
    findInputByNonce,
    findMintBySigHash,
    findReleaseBySigHash,
    getPastLogs,
    mapBurnLogToInputChainTransaction,
    mapBurnToChainLogToInputChainTransaction,
    mapLockLogToInputChainTransaction,
    mapTransferLogToInputChainTransaction,
    resolveEVMNetworkConfig,
    resolveRpcEndpoints,
    txHashFromBytes,
    txHashToBytes,
    txHashToChainTransaction,
    validateAddress,
    validateTransaction,
} from "./utils/generic";
import { accountPayloadHandler } from "./utils/payloads/evmAddressPayload";
import { approvalPayloadHandler } from "./utils/payloads/evmApprovalPayload";
import { contractPayloadHandler } from "./utils/payloads/evmContractPayload";
import {
    EVMParam,
    EVMParamValues,
    EVMPayloadInterface,
    PayloadHandler,
} from "./utils/payloads/evmParams";
import { EVMTxPayload, txPayloadHandler } from "./utils/payloads/evmTxPayload";
import {
    EthereumClassConfig,
    EthProvider,
    EthSigner,
    EVMExplorer,
    EVMNetworkConfig,
    EVMNetworkInput,
    StandardEVMExplorer,
} from "./utils/types";

export class EthereumBaseChain
    implements ContractChain<EVMPayloadInterface, EVMPayloadInterface>
{
    public static chain: string;
    public chain: string;

    public assets: { [asset: string]: string } = {};

    public static configMap: {
        [network in RenNetwork]?: EVMNetworkConfig;
    } = {};
    public configMap: {
        [network in RenNetwork]?: EVMNetworkConfig;
    } = {};

    public provider: Provider;
    public signer?: EthSigner;
    public network: EVMNetworkConfig;
    public explorer: EVMExplorer;

    private _logger: Logger;
    private _config: EthereumClassConfig | undefined;

    public constructor({
        network,
        provider,
        signer,
        config,
    }: {
        network: EVMNetworkInput;
        provider?: EthProvider;
        signer?: EthSigner;
        config?: EthereumClassConfig;
    }) {
        this.network = resolveEVMNetworkConfig(this.configMap, network);
        this.chain = this.network.selector;
        this.explorer = StandardEVMExplorer(
            this.network.config.blockExplorerUrls &&
                this.network.config.blockExplorerUrls.length
                ? this.network.config.blockExplorerUrls[0]
                : "",
        );
        this._logger = (config && config.logger) || defaultLogger;
        this._config = config;

        // Ignore not configured error.
        this.provider = undefined as never;
        this.withProvider(
            provider || resolveRpcEndpoints(this.network.config.rpcUrls)[0],
        );
        if (signer) {
            this.withSigner(signer);
        }
    }

    public getMintAsset = utils.memoize(
        async (asset: string): Promise<string> =>
            await getRenAsset(this.network, this.provider, asset),
    );
    public getRenAsset = this.getMintAsset;

    public getMintGateway = utils.memoize(
        async (asset: string): Promise<string> =>
            await getMintGateway(this.network, this.provider, asset),
    );

    public getLockAsset = utils.memoize(
        async (asset: string): Promise<string> =>
            await getLockAsset(this.network, this.provider, asset),
    );

    public getLockGateway = utils.memoize(
        async (asset: string): Promise<string> =>
            await getLockGateway(this.network, this.provider, asset),
    );

    public validateAddress = validateAddress;
    public validateTransaction = validateTransaction;
    public addressExplorerLink = (address: string): string => {
        return this.explorer.address(address);
    };

    public addressToBytes = (address: string): Uint8Array => {
        return utils.fromHex(address);
    };

    public addressFromBytes = (bytes: Uint8Array): string => {
        return ethers.utils.getAddress(utils.Ox(bytes));
    };

    public txHashToBytes = (txHash: string): Uint8Array => {
        return txHashToBytes(txHash);
    };

    public txHashFromBytes = (bytes: Uint8Array): string => {
        return txHashFromBytes(bytes);
    };

    public transactionExplorerLink = ({
        txid,
        txHash,
    }: Partial<ChainTransaction> & ({ txid: string } | { txHash: string })):
        | string
        | undefined => {
        if (txHash) {
            return this.explorer.transaction(txHash);
        } else if (txid) {
            return this.explorer.transaction(
                this.txHashFromBytes(utils.fromBase64(txid)),
            );
        }
        return undefined;
    };

    public withProvider = (web3Provider: EthProvider): this => {
        this.provider = Provider.isProvider(web3Provider)
            ? web3Provider
            : typeof web3Provider === "string"
            ? new ethers.providers.JsonRpcProvider(web3Provider)
            : // TODO: Set chainId instead of "any"?
              new ethers.providers.Web3Provider(web3Provider, "any");
        if (!this.signer) {
            try {
                this.signer = (this.provider as Web3Provider).getSigner();
            } catch (error: unknown) {
                // Ignore error.
            }
        } else {
            try {
                this.signer.connect(this.provider);
            } catch (error: unknown) {
                // Ignore - doesnt' work on all signers.
                // e.g. JsonRpc signer throws:
                // `cannot alter JSON-RPC Signer connection`.
            }
        }
        return this;
    };

    public withSigner = (signer: EthSigner): this => {
        this.signer = signer;
        try {
            this.signer.connect(this.provider);
        } catch (error: unknown) {
            // Ignore - doesnt' work on all signers.
            // e.g. JsonRpc signer throws:
            // `cannot alter JSON-RPC Signer connection`.
        }
        return this;
    };

    public checkProviderNetwork = async (
        provider?: Provider,
    ): Promise<{
        result: boolean;
        actualNetworkId: number;

        expectedNetworkId: number;
        expectedNetworkLabel: string;
    }> => {
        return checkProviderNetwork(provider || this.provider, this.network);
    };
    public checkProviderNetworkCached = utils.memoize(
        this.checkProviderNetwork,
        {
            expiry: 10 * utils.sleep.SECONDS,
        },
    );

    public checkSignerNetwork = async (): Promise<{
        result: boolean;
        actualNetworkId: number;

        expectedNetworkId: number;
        expectedNetworkLabel: string;
    }> => {
        if (!this.signer) {
            throw new Error(`Must connect ${this.chain} signer.`);
        }
        return this.checkProviderNetwork(
            // If the signer as no provider, fall back to the provider field.
            this.signer.provider || this.provider,
        );
    };

    public switchSignerNetwork = async (): Promise<void> => {
        if (!this.signer) {
            throw new Error(`Must connect ${this.chain} signer.`);
        }
        if (
            !this.signer.provider ||
            !(this.signer.provider as JsonRpcProvider).send
        ) {
            throw new Error(`Signer doesn't support switching network.`);
        }

        // Check if the network is an Ethereum network, to avoid MetaMask
        // throwing `Must not specify default MetaMask chain`.
        // TODO: Try addEthereumChain first and fallback to switchEthereumChain
        // based on the returned error message.
        if (
            // Ethereum chains
            this.network.nativeAsset.symbol === "ETH" ||
            // Goerli
            this.network.nativeAsset.symbol === "gETH"
        ) {
            await (this.signer.provider as JsonRpcProvider).send(
                "wallet_switchEthereumChain",
                [
                    {
                        chainId: this.network.config.chainId,
                    },
                ],
            );
        } else {
            await (this.signer.provider as JsonRpcProvider).send(
                "wallet_addEthereumChain",
                [this.network.config],
            );
        }
    };

    public getOutputPayload = async (
        asset: string,
        inputType: InputType,
        outputType: OutputType,
        contractCall: EVMPayloadInterface,
    ): Promise<
        | {
              to: string;
              toBytes: Uint8Array;
              payload: Uint8Array;
          }
        | undefined
    > => {
        const providerNetworkCheck = await this.checkProviderNetworkCached();
        if (!providerNetworkCheck.result) {
            throw new ErrorWithCode(
                `Invalid ${this.chain} provider network: expected ${providerNetworkCheck.expectedNetworkId} (${providerNetworkCheck.expectedNetworkLabel}), got ${providerNetworkCheck.actualNetworkId}.`,
                RenJSError.INCORRECT_PROVIDER_NETWORK,
            );
        }

        if (contractCall.type === undefined) {
            return undefined;
        }
        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler.getPayload) {
            throw ErrorWithCode.updateError(
                new Error(
                    `'${contractCall.type}' payload type can only be used as a setup payload.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        const { to, toBytes, payload } = await handler.getPayload({
            network: this.network,
            signer: this.signer,
            payload: contractCall,
            evmParams: this.getEVMParams(
                asset,
                inputType,
                outputType,
                outputType,
                {},
            ),
            getPayloadHandler: this.getPayloadHandler,
        });

        return {
            to:
                contractCall.payloadConfig &&
                contractCall.payloadConfig.preserveAddressFormat
                    ? to
                    : ethers.utils.getAddress(to),
            toBytes,
            payload,
        };
    };

    // Supported assets

    /** Return true if the asset originates from the chain. */

    // Wrapper to expose _isLockAsset as a class method instead of a property
    public isLockAsset = utils.memoize(
        async (assetSymbol: string): Promise<boolean> => {
            // Check if it in the list of hard-coded assets.
            if (
                Object.keys(this.assets).includes(assetSymbol) ||
                assetSymbol === this.network.nativeAsset.symbol
            ) {
                return true;
            }

            // Check if the asset has an associated lock-gateway.
            try {
                if (await this.getLockAsset(assetSymbol)) {
                    return true;
                }
            } catch (error: unknown) {
                return false;
            }

            return false;
        },
    );

    public isDepositAsset = (assetSymbol: string): boolean => {
        return assetSymbol === this.network.nativeAsset.symbol;
    };

    /**
     * `assetIsSupported` should return true if the asset is native to the
     * MintChain.
     *
     * ```ts
     * ethereum.assetIsSupported = asset => asset === "ETH";
     * ```
     */
    public isMintAsset = utils.memoize(
        async (asset: string): Promise<boolean> => {
            // Check that there's a gateway contract for the asset.
            try {
                return (await this.getMintAsset(asset)) !== undefined;
            } catch (error: unknown) {
                // Check that the error isn't caused by being on the wrong network.
                const providerNetworkCheck =
                    await this.checkProviderNetworkCached();
                if (!providerNetworkCheck.result) {
                    throw new ErrorWithCode(
                        `Invalid ${this.chain} provider network: expected ${providerNetworkCheck.expectedNetworkId} (${providerNetworkCheck.expectedNetworkLabel}), got ${providerNetworkCheck.actualNetworkId}.`,
                        RenJSError.INCORRECT_PROVIDER_NETWORK,
                    );
                }
                if (
                    error instanceof Error &&
                    /(Empty address returned)|(not supported)/.exec(
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        String((error || {}).message),
                    )
                ) {
                    // Ignore
                } else {
                    this._logger.warn(error);
                }
                return false;
            }
        },
    );

    /**
     * `assetDecimals` should return the number of decimals of the asset.
     *
     * If the asset is not supported, an error should be thrown.
     *
     */
    public assetDecimals = utils.memoize(
        async (asset: string): Promise<number> => {
            // TODO: get lock asset decimals

            if (asset === this.network.nativeAsset.symbol) {
                return this.network.nativeAsset.decimals;
            }

            let tokenAddress: string;
            if (await this.isLockAsset(asset)) {
                tokenAddress = await this.getLockAsset(asset);
            } else if (await this.isMintAsset(asset)) {
                tokenAddress = await this.getMintAsset(asset);
            } else {
                throw new Error(
                    `Asset '${asset}' not supported on ${this.chain}.`,
                );
            }

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

            const decimalsRaw = await tokenContract.decimals();
            return new BigNumber(decimalsRaw.toString()).toNumber();
        },
        { expiry: false },
    );

    public transactionConfidence = async (
        transaction: ChainTransaction,
    ): Promise<BigNumber> => {
        if (transaction.txid === "") {
            throw new Error(
                `Unable to fetch transaction confidence, transaction hash not set.`,
            );
        }
        const currentBlock = new BigNumber(
            (await this.provider.getBlockNumber()).toString(),
        );
        const receipt = await this.provider.getTransactionReceipt(
            transaction.txHash,
        );
        if (receipt === null) {
            throw ErrorWithCode.updateError(
                new Error(
                    `${String(transaction.chain)} transaction not found: ${
                        transaction.txHash
                    }`,
                ),
                RenJSError.TRANSACTION_NOT_FOUND,
            );
        }
        if (receipt.status === 0) {
            throw ErrorWithCode.updateError(
                new Error(
                    `${String(transaction.chain)} transaction failed: ${
                        transaction.txHash
                    }`,
                ),
                RenJSError.CHAIN_TRANSACTION_REVERTED,
            );
        }
        if (receipt && receipt.blockNumber) {
            const transactionBlock = new BigNumber(
                receipt.blockNumber.toString(),
            );
            return currentBlock.minus(transactionBlock).plus(1);
        } else {
            return new BigNumber(0);
        }
    };

    public getBalance = async (
        asset: string,
        address?: string,
    ): Promise<BigNumber> => {
        if (!address) {
            if (!this.signer) {
                throw new Error(
                    `Must connect ${this.chain} signer or provide address.`,
                );
            }
            address = address || (await this.signer.getAddress());
        }

        if (asset === this.network.nativeAsset.symbol) {
            return new BigNumber(
                (await this.provider.getBalance(address)).toString(),
            );
        }

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

        let tokenAddress;
        if (await this.isMintAsset(asset)) {
            tokenAddress = await this.getMintAsset(asset);
        } else if (await this.isLockAsset(asset)) {
            tokenAddress = await this.getLockAsset(asset);
        } else {
            throw new Error(`Asset '${asset}' not supported on ${this.chain}.`);
        }

        const tokenContract = new ethers.Contract(
            tokenAddress,
            [balanceOfABI],
            this.provider,
        );

        const balanceRaw = await await tokenContract.balanceOf(address);

        return new BigNumber(balanceRaw.toString());
    };

    public getOutputTx = async (
        inputType: InputType,
        outputType: OutputType,
        asset: string,
        contractCall: EVMPayloadInterface,
        getParams: () => {
            pHash: Uint8Array;
            nHash: Uint8Array;
            amount?: BigNumber;
            sigHash?: Uint8Array;
            signature?: Uint8Array;
        },
        confirmationTarget: number,
    ): Promise<TxSubmitter | TxWaiter> => {
        const providerNetworkCheck = await this.checkProviderNetworkCached();
        if (!providerNetworkCheck.result) {
            throw new ErrorWithCode(
                `Invalid ${this.chain} provider network: expected ${providerNetworkCheck.expectedNetworkId} (${providerNetworkCheck.expectedNetworkLabel}), got ${providerNetworkCheck.actualNetworkId}.`,
                RenJSError.INCORRECT_PROVIDER_NETWORK,
            );
        }

        const findExistingTransaction = async (): Promise<
            ChainTransaction | undefined
        > => {
            const { nHash, sigHash } = getParams();
            const txHash: string | undefined =
                outputType === OutputType.Release
                    ? await findReleaseBySigHash(
                          this.network,
                          this.provider,
                          asset,
                          nHash,
                          sigHash,
                          this.network.logRequestLimit,
                      )
                    : await findMintBySigHash(
                          this.network,
                          this.provider,
                          asset,
                          nHash,
                          sigHash,
                          this.network.logRequestLimit,
                      );
            return utils.isDefined(txHash)
                ? txHashToChainTransaction(
                      this.chain,
                      txHash,
                      (this.transactionExplorerLink &&
                          this.transactionExplorerLink({ txHash })) ||
                          "",
                  )
                : undefined;
        };

        const existingTransaction = await findExistingTransaction();

        if (existingTransaction) {
            return new DefaultTxWaiter({
                chainTransaction: existingTransaction,
                chain: this,
                target: confirmationTarget,
            });
        }

        // const overrideArray = Object.keys(override || {}).map((key) => ({
        //     name: key,
        //     value: (override || {})[key],
        // }));

        // Override contract call parameters that have been passed in to
        // "mint".
        // contractCall = overrideContractCall(contractCall, {
        //     contractParams: overrideArray,
        // });

        // // Filter parameters that should be included in the payload hash but
        // // not the contract call.
        // contractCalls = contractCalls.map((call) => ({
        //     ...call,
        //     contractParams: call.contractParams
        //         ? call.contractParams.filter((param) => !param.onlyInPayload)
        //         : call.contractParams,
        // }));

        if (contractCall.type === "transaction") {
            return new DefaultTxWaiter({
                chain: this,
                target: confirmationTarget,
                chainTransaction: contractCall.params.tx,
            });
        }

        return new EVMTxSubmitter({
            getProvider: () => this.provider,
            getSigner: () => this.signer,
            network: this.network,
            chain: this.chain,
            payload: contractCall,
            target: confirmationTarget,
            getPayloadHandler: this.getPayloadHandler,
            getParams: () =>
                this.getEVMParams(
                    asset,
                    inputType,
                    outputType,
                    outputType,
                    getParams(),
                ),
            findExistingTransaction,
            transactionExplorerLink: this.transactionExplorerLink,
        });
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    public getInputTx = async (
        inputType: InputType,
        outputType: OutputType,
        asset: string,
        contractCall: EVMPayloadInterface,
        getParams: () => {
            toChain: string;
            toPayload:
                | {
                      to: string;
                      payload: Uint8Array;
                  }
                | undefined;
            gatewayAddress?: string;
        },
        confirmationTarget: number,
        onInput: (input: InputChainTransaction) => void,
    ): Promise<TxSubmitter | TxWaiter> => {
        const providerNetworkCheck = await this.checkProviderNetworkCached();
        if (!providerNetworkCheck.result) {
            throw new ErrorWithCode(
                `Invalid ${this.chain} provider network: expected ${providerNetworkCheck.expectedNetworkId} (${providerNetworkCheck.expectedNetworkLabel}), got ${providerNetworkCheck.actualNetworkId}.`,
                RenJSError.INCORRECT_PROVIDER_NETWORK,
            );
        }

        // if (!transaction && burnNonce) {
        //     const nonceBytes = burnNonce instanceof Uint8Array
        //         ? burnNonce
        //         : toNBytes(burnNonce, 32);

        //     return [
        //         await findBurnByNonce(
        //             this.renNetworkDetails,
        //             this.provider,
        //             asset,
        //             nonceBytes,
        //         ),
        //     ];
        // }

        // if (!transaction) {
        //     return undefined;
        // }

        // eventEmitter.emit("transaction", {
        //     txid: transaction.txid,
        //     txindex: "0",
        // });

        // const receipt = await waitForReceipt(
        //     this.provider,
        //     this.txidToTxidFormatted(transaction),
        //     this.logger,
        //     config.networkDelay,
        // );

        // return extractBurnDetails(receipt);

        const onReceipt = (receipt: ethers.providers.TransactionReceipt) => {
            if (inputType === InputType.Burn) {
                const logBurnABI = findABIMethod(MintGatewayABI, "LogBurn");
                filterLogs<LogBurnEvent>(receipt.logs, logBurnABI)
                    .map((e) =>
                        mapBurnLogToInputChainTransaction(
                            this.chain,
                            asset,
                            e.event,
                            this.transactionExplorerLink({
                                txHash: e.log.transactionHash,
                            }) || "",
                        ),
                    )
                    .map(onInput);

                // Filter logs that are releases to other chains.
                const { toChain: receiptToChain } = getParams();
                const filterByRecipientChain = (e: {
                    event: LogBurnToChainEvent;
                }) => {
                    const [_recipientAddress, recipientChain] = e.event.args;
                    return recipientChain === receiptToChain;
                };

                const logBurnToChainABI = findABIMethod(
                    MintGatewayABI,
                    "LogBurnToChain",
                );
                filterLogs<LogBurnToChainEvent>(receipt.logs, logBurnToChainABI)
                    .filter(filterByRecipientChain)
                    .map((e) =>
                        mapBurnToChainLogToInputChainTransaction(
                            this.chain,
                            asset,
                            e.event,
                            this.transactionExplorerLink({
                                txHash: e.log.transactionHash,
                            }) || "",
                        ),
                    )
                    .map(onInput);
            } else {
                const logLockABI = findABIMethod(
                    LockGatewayABI,
                    "LogLockToChain",
                );
                const lockEvents = filterLogs<LogLockToChainEvent>(
                    receipt.logs,
                    logLockABI,
                ).map((e) =>
                    mapLockLogToInputChainTransaction(
                        this.chain,
                        asset,
                        e.event,
                        this.transactionExplorerLink({
                            txHash: e.log.transactionHash,
                        }) || "",
                    ),
                );
                lockEvents.map(onInput);

                const logTransferredABI = findABIMethod(
                    TransferWithLogABI,
                    "LogTransferred",
                );
                const transferEvents = filterLogs<LogTransferredEvent>(
                    receipt.logs,
                    logTransferredABI,
                ).map((e) =>
                    mapTransferLogToInputChainTransaction(
                        this.chain,
                        asset,
                        e.event,
                        this.transactionExplorerLink({
                            txHash: e.log.transactionHash,
                        }) || "",
                    ),
                );
                transferEvents.map(onInput);

                if (lockEvents.length === 0 && transferEvents.length === 0) {
                    throw new Error(
                        `No inputs found in transaction ${receipt.transactionHash}.`,
                    );
                }
            }
        };

        if (contractCall.type === "transaction") {
            return new DefaultTxWaiter({
                chain: this,
                target: confirmationTarget,
                chainTransaction: contractCall.params.tx,
                onFirstProgress: async (tx: ChainTransaction) => {
                    onReceipt(
                        await this.provider.getTransactionReceipt(tx.txHash),
                    );
                },
            });
        }

        if (contractCall.type === "nonce") {
            const nonce = utils.toNBytes(
                new BigNumber(contractCall.params.nonce),
                32,
            );
            const chainTransaction = await findInputByNonce(
                this.chain,
                inputType,
                this.network,
                this.provider,
                asset,
                nonce,
                this.transactionExplorerLink,
            );
            if (!chainTransaction) {
                throw new Error(
                    `Unable to find ${asset} ${inputType} on ${
                        this.chain
                    } with nonce ${String(contractCall.params.nonce)}.`,
                );
            }
            return new DefaultTxWaiter({
                chain: this,
                target: confirmationTarget,
                chainTransaction,
                onFirstProgress: async (tx: ChainTransaction) => {
                    onReceipt(
                        await this.provider.getTransactionReceipt(tx.txHash),
                    );
                },
            });
        }

        // const { toChain, toPayload } = getParams();
        // if (!toPayload) {
        //     throw new Error(
        //         `Unable to generate ${this.chain} transaction: No ${toChain} payload.`,
        //     );
        // }

        return new EVMTxSubmitter({
            getProvider: () => this.provider,
            getSigner: () => this.signer,
            network: this.network,
            chain: this.chain,
            payload: contractCall,
            target: confirmationTarget,
            getPayloadHandler: this.getPayloadHandler,
            getParams: () =>
                this.getEVMParams(
                    asset,
                    inputType,
                    outputType,
                    inputType,
                    getParams(),
                ),
            onReceipt: onReceipt,
            transactionExplorerLink: this.transactionExplorerLink,
        });
    };

    public getInSetup = async (
        asset: string,
        inputType: InputType,
        outputType: OutputType,
        contractCall: EVMPayloadInterface,
        getParams: () => {
            toChain: string;
            toPayload:
                | {
                      to: string;
                      toBytes: Uint8Array;
                      payload: Uint8Array;
                  }
                | undefined;
            gatewayAddress?: string;
        },
    ): Promise<{ [key: string]: EVMTxSubmitter | TxWaiter }> => {
        if (!contractCall.type) {
            return {};
        }

        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler || !handler.getSetup) {
            return {};
        }

        const calls = await handler.getSetup({
            network: this.network,
            signer: this.signer,
            payload: contractCall,
            evmParams: this.getEVMParams(
                asset,
                inputType,
                outputType,
                inputType,
                getParams(),
            ),
            getPayloadHandler: this.getPayloadHandler,
        });

        const txSubmitted: { [key: string]: EVMTxSubmitter | TxWaiter } = {};
        for (const callKey of Object.keys(calls)) {
            if (calls[callKey].type === "transaction") {
                txSubmitted[callKey] = new DefaultTxWaiter({
                    chain: this,
                    target: 1,
                    chainTransaction: (calls[callKey] as EVMTxPayload).params
                        .tx,
                });
            } else {
                txSubmitted[callKey] = new EVMTxSubmitter({
                    getProvider: () => this.provider,
                    getSigner: () => this.signer,
                    network: this.network,
                    chain: this.chain,
                    payload: calls[callKey],
                    target: 1,
                    getPayloadHandler: this.getPayloadHandler,
                    getParams: () =>
                        this.getEVMParams(
                            asset,
                            inputType,
                            outputType,
                            inputType,
                            getParams(),
                        ),
                    transactionExplorerLink: this.transactionExplorerLink,
                });
            }
        }
        return txSubmitted;
    };

    public getOutSetup = async (
        asset: string,
        inputType: InputType,
        outputType: OutputType,
        contractCall: EVMPayloadInterface,
        getParams: () => {
            pHash: Uint8Array;
            nHash: Uint8Array;
            amount?: BigNumber;
            sigHash?: Uint8Array;
            signature?: Uint8Array;
        },
    ): Promise<{ [key: string]: EVMTxSubmitter | TxWaiter }> => {
        if (!contractCall.type) {
            return {};
        }

        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler || !handler.getSetup) {
            return {};
        }

        const calls = await handler.getSetup({
            network: this.network,
            signer: this.signer,
            payload: contractCall,
            evmParams: this.getEVMParams(
                asset,
                inputType,
                outputType,
                outputType,
                getParams(),
            ),
            getPayloadHandler: this.getPayloadHandler,
        });

        const txSubmitted: { [key: string]: EVMTxSubmitter | TxWaiter } = {};
        for (const callKey of Object.keys(calls)) {
            if (calls[callKey].type === "transaction") {
                txSubmitted[callKey] = new DefaultTxWaiter({
                    chain: this,
                    target: 1,
                    chainTransaction: (calls[callKey] as EVMTxPayload).params
                        .tx,
                });
            } else {
                txSubmitted[callKey] = new EVMTxSubmitter({
                    getProvider: () => this.provider,
                    getSigner: () => this.signer,
                    network: this.network,
                    chain: this.chain,
                    payload: calls[callKey],
                    target: 1,
                    getPayloadHandler: this.getPayloadHandler,
                    getParams: () =>
                        this.getEVMParams(
                            asset,
                            inputType,
                            outputType,
                            outputType,
                            getParams(),
                        ),
                    transactionExplorerLink: this.transactionExplorerLink,
                });
            }
        }
        return txSubmitted;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getPayloadHandler = (payloadType: string): PayloadHandler<any> => {
        switch (payloadType) {
            case "approval":
                return approvalPayloadHandler;
            case "contract":
                return contractPayloadHandler;
            case "address":
                return accountPayloadHandler;
            case "transaction":
                return txPayloadHandler;
        }

        // TODO: Allow adding custom payload handlers.

        throw new Error(`Unknown payload type ${payloadType}`);
    };

    public createGatewayAddress = (
        _asset: string,
        fromPayload: EVMPayloadInterface,
        shardPublicKey: Uint8Array,
        gHash: Uint8Array,
    ): Promise<string> | string => {
        if (fromPayload.chain !== this.chain) {
            throw new Error(
                `Invalid payload for chain ${fromPayload.chain} instead of ${this.chain}.`,
            );
        }

        const ec = new elliptic.ec("secp256k1");

        // Decode compressed RenVM public key.
        const renVMPublicKey = ec.keyFromPublic(shardPublicKey);

        // Interpret gHash as a private key.
        const gHashKey = ec.keyFromPrivate(gHash);

        // If `NO_PARAMS_FLAG` is set, set renVM public key and gHash public key,
        // and recreate key pair from resulting curve point.
        const derivedPublicKey = ec.keyFromPublic(
            renVMPublicKey
                .getPublic()
                .add(gHashKey.getPublic()) as unknown as elliptic.ec.KeyPair,
        );

        return computeAddress(
            utils.fromHex(derivedPublicKey.getPublic(false, "hex")),
        );
    };

    private getEVMParams = (
        asset: string,
        inputType: InputType,
        outputType: OutputType,
        transactionType: InputType | OutputType | "setup",
        params: {
            // Input
            toChain?: string;
            toPayload?: {
                to: string;
                payload: Uint8Array;
            };
            gatewayAddress?: string;

            // Output
            pHash?: Uint8Array;
            amount?: BigNumber;
            nHash?: Uint8Array;
            sigHash?: Uint8Array;
            signature?: Uint8Array;
        },
    ): EVMParamValues => {
        return {
            // Always available
            [EVMParam.EVM_INPUT_TYPE]: inputType,
            [EVMParam.EVM_OUTPUT_TYPE]: outputType,
            [EVMParam.EVM_TRANSACTION_TYPE]: transactionType,
            [EVMParam.EVM_TOKEN_ADDRESS]: async () => {
                if (
                    transactionType === InputType.Lock ||
                    transactionType === OutputType.Release
                ) {
                    return await this.getLockAsset(asset);
                } else {
                    return await this.getMintAsset(asset);
                }
            },
            [EVMParam.EVM_TOKEN_DECIMALS]: async () =>
                await this.assetDecimals(asset),
            [EVMParam.EVM_ACCOUNT]: async () => {
                if (!this.signer) {
                    throw ErrorWithCode.updateError(
                        new Error(`Must connect ${this.chain} signer.`),
                        RenJSError.PARAMETER_ERROR,
                    );
                }
                try {
                    return await this.signer.getAddress();
                } catch (error) {
                    if (
                        ErrorWithCode.isErrorWithCode(error) &&
                        error.code === errors.UNSUPPORTED_OPERATION
                    ) {
                        throw ErrorWithCode.updateError(
                            new Error(
                                `Must connect ${this.chain} signer - unable to get address.`,
                            ),
                            RenJSError.PARAMETER_ERROR,
                        );
                    }
                    throw error;
                }
            },
            [EVMParam.EVM_ACCOUNT_IS_CONTRACT]: async () => {
                if (!this.signer) {
                    throw ErrorWithCode.updateError(
                        new Error(`Must connect ${this.chain} signer.`),
                        RenJSError.PARAMETER_ERROR,
                    );
                }
                try {
                    const account = await this.signer.getAddress();
                    const codeString = await this.provider.getCode(account);
                    return utils.fromHex(codeString).length > 0;
                } catch (error) {
                    if (
                        ErrorWithCode.isErrorWithCode(error) &&
                        error.code === errors.UNSUPPORTED_OPERATION
                    ) {
                        throw ErrorWithCode.updateError(
                            new Error(
                                `Must connect ${this.chain} signer - unable to get code at address.`,
                            ),
                            RenJSError.PARAMETER_ERROR,
                        );
                    }
                    throw error;
                }
            },
            [EVMParam.EVM_GATEWAY]: async () => {
                if (
                    transactionType === InputType.Lock ||
                    transactionType === OutputType.Release
                ) {
                    return await this.getLockGateway(asset);
                } else {
                    return await this.getMintGateway(asset);
                }
            },
            [EVMParam.EVM_TRANSFER_WITH_LOG_CONTRACT]: async () =>
                await getGatewayRegistryInstance(
                    this.provider,
                    this.network.addresses.GatewayRegistry,
                ).getTransferContract(),
            [EVMParam.EVM_ASSET]: asset,
            [EVMParam.EVM_CHAIN]: this.chain,

            // Available when minting or releasing
            [EVMParam.EVM_AMOUNT]: utils.isDefined(params.amount)
                ? params.amount.toFixed()
                : undefined, // in wei
            [EVMParam.EVM_NHASH]: params.nHash,
            [EVMParam.EVM_PHASH]: params.pHash,
            [EVMParam.EVM_SIGNATURE]: params.signature,
            [EVMParam.EVM_SIGNATURE_R]: utils.isDefined(params.signature)
                ? params.signature.slice(0, 32)
                : undefined,
            [EVMParam.EVM_SIGNATURE_S]: utils.isDefined(params.signature)
                ? params.signature.slice(32, 64)
                : undefined,
            [EVMParam.EVM_SIGNATURE_V]: utils.isDefined(params.signature)
                ? params.signature.slice(64, 65)[0]
                : undefined,

            // Available when locking or burning
            [EVMParam.EVM_TO_CHAIN]: params.toChain,
            [EVMParam.EVM_TO_ADDRESS_BYTES]: utils.isDefined(params.toPayload)
                ? utils.fromUTF8String(params.toPayload.to)
                : undefined,
            [EVMParam.EVM_TO_ADDRESS]: utils.isDefined(params.toPayload)
                ? params.toPayload.to
                : undefined,
            [EVMParam.EVM_TO_PAYLOAD]: utils.isDefined(params.toPayload)
                ? params.toPayload.payload
                : undefined,
            [EVMParam.EVM_GATEWAY_DEPOSIT_ADDRESS]: params.gatewayAddress,
            [EVMParam.EVM_GATEWAY_IS_DEPOSIT_ASSET]: this.isDepositAsset(asset),
        };
    };

    public populateChainTransaction = (
        partialTx: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ): ChainTransaction => {
        return populateChainTransaction({
            partialTx,
            chain: this.chain,
            txHashToBytes,
            txHashFromBytes,
            defaultTxindex: "0",
            explorerLink: this.transactionExplorerLink,
        });
    };

    public watchForDeposits = async (
        asset: string,
        fromPayload: EVMPayloadInterface,
        address: string,
        onInput: (input: InputChainTransaction) => void,
        _removeInput: (input: InputChainTransaction) => void,
        listenerCancelled: () => boolean,
    ): Promise<void> => {
        if (fromPayload.chain !== this.chain) {
            throw new Error(
                `Invalid payload for chain ${fromPayload.chain} instead of ${this.chain}.`,
            );
        }

        if (
            !fromPayload.payloadConfig ||
            !fromPayload.payloadConfig.detectPreviousDeposits
        ) {
            while (!listenerCancelled()) {
                // Nothing more to do.
                await utils.sleep(1 * utils.sleep.SECONDS);
            }
        }

        const logTransferredABI = findABIMethod(
            TransferWithLogABI,
            "LogTransferred",
        );

        // If the payload is a transaction, submit it to onInput and then loop
        // indefinitely.
        if (fromPayload.type === "transaction") {
            const receipt = await this.provider.getTransactionReceipt(
                (fromPayload as EVMTxPayload).params.tx.txHash,
            );
            const transferEvents = filterLogs<LogTransferredEvent>(
                receipt.logs,
                logTransferredABI,
            ).map((e) =>
                mapTransferLogToInputChainTransaction(
                    this.chain,
                    asset,
                    e.event,
                    this.transactionExplorerLink({
                        txHash: e.log.transactionHash,
                    }) || "",
                ),
            );
            transferEvents.map(onInput);

            while (!listenerCancelled()) {
                // Nothing more to do.
                await utils.sleep(1 * utils.sleep.SECONDS);
            }
        } else {
            const registry = getGatewayRegistryInstance(
                this.provider,
                this.network.addresses.GatewayRegistry,
            );
            const transferWithLogAddress = await registry.getTransferContract();

            const transferEvents = (
                await getPastLogs<LogTransferredEvent>(
                    this.provider,
                    transferWithLogAddress,
                    logTransferredABI,
                    [
                        null,
                        utils.Ox(utils.toNBytes(utils.fromHex(address), 32)),
                        null,
                    ],
                    this.network.logRequestLimit,
                )
            ).map((e) =>
                mapTransferLogToInputChainTransaction(
                    this.chain,
                    asset,
                    e.event,
                    this.transactionExplorerLink({
                        txHash: e.log.transactionHash,
                    }) || "",
                ),
            );
            transferEvents.map(onInput);
        }
    };

    /* ====================================================================== */

    public Account = ({
        account,
        amount,
        convertUnit,
        anyoneCanSubmit,
        infiniteApproval,
        payloadConfig,
    }: {
        account?: string;
        amount?: BigNumber | string | number;
        convertUnit?: boolean;
        anyoneCanSubmit?: boolean;
        infiniteApproval?: boolean;
        payloadConfig?: EVMPayloadInterface["payloadConfig"];
    } = {}): EVMPayloadInterface => {
        assertType<BigNumber | string | number | undefined>(
            "BigNumber | string | number | undefined",
            { amount },
        );
        assertType<boolean | undefined>("boolean | undefined", {
            convertUnit,
        });

        let fixedAmount;
        if (utils.isDefined(amount)) {
            fixedAmount = BigNumber.isBigNumber(amount)
                ? amount
                : new BigNumber(amount.toString());
            if (fixedAmount.isNaN()) {
                throw ErrorWithCode.updateError(
                    new Error(
                        `Invalid numeric-value 'amount'. (amount: ${amount.toString()})`,
                    ),
                    RenJSError.PARAMETER_ERROR,
                );
            } else if (!convertUnit && fixedAmount.decimalPlaces() !== 0) {
                throw ErrorWithCode.updateError(
                    new Error(
                        `Amount must be provided in Wei as an integer, or 'convertUnit' must be set to 'true'. (amount: ${amount.toString()})`,
                    ),
                    RenJSError.PARAMETER_ERROR,
                );
            }
        }

        if (account && account.slice(0, 5) !== "__EVM") {
            if (!this.validateAddress(account)) {
                new ErrorWithCode(
                    `Invalid ${this.chain} address: ${String(account)}`,
                    RenJSError.PARAMETER_ERROR,
                );
            }
            if (!(payloadConfig && payloadConfig.preserveAddressFormat)) {
                // Convert to checksum account.
                account = ethers.utils.getAddress(account);
            }
        }

        return {
            chain: this.chain,
            type: "address",
            params: {
                address: account || EVMParam.EVM_ACCOUNT,
                amount: fixedAmount ? fixedAmount.toFixed() : undefined,
                convertUnit,
                anyoneCanSubmit,
                infiniteApproval,
            },
            payloadConfig,
        };
    };

    public Address = (
        address: string,
        payloadConfig?: EVMPayloadInterface["payloadConfig"],
    ): EVMPayloadInterface => {
        assertType<string>("string", {
            address,
        });

        if (address.slice(0, 5) !== "__EVM") {
            if (!this.validateAddress(address)) {
                new ErrorWithCode(
                    `Invalid ${this.chain} address: ${String(address)}`,
                    RenJSError.PARAMETER_ERROR,
                );
            }
            if (!(payloadConfig && payloadConfig.preserveAddressFormat)) {
                // Convert to checksum address.
                address = ethers.utils.getAddress(address);
            }
        }

        return {
            chain: this.chain,
            type: "address",
            params: {
                address,
                anyoneCanSubmit: true,
            },
            payloadConfig,
        };
    };

    public Contract = (params: {
        to: string;
        method: string;
        params: EthArg[];
        withRenParams: boolean;
        txConfig?: ethers.PayableOverrides;
        payloadConfig?: EVMPayloadInterface["payloadConfig"];
    }): EVMPayloadInterface => {
        let { to } = params;
        if (to.slice(0, 5) !== "__EVM") {
            if (!this.validateAddress(to)) {
                new ErrorWithCode(
                    `Invalid ${this.chain} contract address: ${String(to)}`,
                    RenJSError.PARAMETER_ERROR,
                );
            }
            if (
                !(
                    params.payloadConfig &&
                    params.payloadConfig.preserveAddressFormat
                )
            ) {
                // Convert to checksum address.
                to = ethers.utils.getAddress(to);
            }
        }

        return {
            chain: this.chain,
            type: "contract",
            params: {
                to,
                method: params.method,
                params: [
                    ...params.params,
                    ...(params.withRenParams
                        ? [
                              {
                                  name: "amount",
                                  type: "uint256",
                                  value: EVMParam.EVM_AMOUNT,
                                  notInPayload: true,
                                  renParam: true,
                              },
                              {
                                  name: "nHash",
                                  type: "bytes32",
                                  value: EVMParam.EVM_NHASH,
                                  notInPayload: true,
                                  renParam: true,
                              },
                              {
                                  name: "signature",
                                  type: "bytes",
                                  value: EVMParam.EVM_SIGNATURE,
                                  notInPayload: true,
                                  renParam: true,
                              },
                          ]
                        : []),
                ],
                txConfig: params.txConfig,
            },
            payloadConfig: params.payloadConfig,
        };
    };

    /**
     * Import an existing Ethereum transaction.
     *
     * @example
     * ethereum.Transaction({
     *   txHash: "0xf7dbf98bcebd7b803917e00e7e3292843a4b7bf66016638811cea4705a32d73e",
     * })
     */
    public Transaction = (
        partialTx: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
        payloadConfig?: EVMPayloadInterface["payloadConfig"],
    ): EVMPayloadInterface => {
        return {
            chain: this.chain,
            type: "transaction",
            params: {
                tx: this.populateChainTransaction(partialTx),
            },
            payloadConfig,
        };
    };
}
