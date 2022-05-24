import { Provider, Web3Provider } from "@ethersproject/providers";
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
    filterLogs,
    findMintBySigHash,
    findReleaseBySigHash,
    mapBurnLogToInputChainTransaction,
    mapBurnToChainLogToInputChainTransaction,
    mapLockLogToInputChainTransaction,
    mapTransferLogToInputChainTransaction,
    txHashFromBytes,
    txHashToBytes,
    validateAddress,
    validateTransaction,
} from "./utils/generic";
import {
    accountPayloadHandler,
    approvalPayloadHandler,
    contractPayloadHandler,
    EVMParam,
    EVMParamValues,
    EVMPayload,
    EVMTxPayload,
    PayloadHandler,
    txPayloadHandler,
} from "./utils/payloads/evmPayloadHandlers";
import {
    EthereumClassConfig,
    EthProvider,
    EthSigner,
    EVMExplorer,
    EVMNetworkConfig,
    StandardEVMExplorer,
} from "./utils/types";

export class EthereumBaseChain
    implements ContractChain<EVMPayload, EVMPayload>
{
    public static chain = "Ethereum";
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

    public constructor({
        network,
        provider,
        signer,
        config,
    }: {
        network: EVMNetworkConfig;
        provider: EthProvider;
        signer?: EthSigner;
        config?: EthereumClassConfig;
    }) {
        this.network = network;
        this.chain = this.network.selector;
        this.explorer = StandardEVMExplorer(
            this.network.config.blockExplorerUrls[0],
        );
        this._logger = (config && config.logger) || defaultLogger;

        // Ignore not configured error.
        this.provider = undefined as never;
        this.withProvider(provider);
        if (signer) {
            this.withSigner(signer);
        }
    }

    private _getMintAsset__memoized?: (asset: string) => Promise<string>;
    public getMintAsset = async (asset_: string): Promise<string> => {
        this._getMintAsset__memoized =
            this._getMintAsset__memoized ||
            utils.memoize(
                async (asset: string): Promise<string> =>
                    await getRenAsset(this.network, this.provider, asset),
            );
        return this._getMintAsset__memoized(asset_);
    };

    private _getMintGateway__memoized?: (asset: string) => Promise<string>;
    public getMintGateway = async (asset_: string): Promise<string> => {
        this._getMintGateway__memoized =
            this._getMintGateway__memoized ||
            utils.memoize(
                async (asset: string): Promise<string> =>
                    await getMintGateway(this.network, this.provider, asset),
            );
        return this._getMintGateway__memoized(asset_);
    };

    private _getLockAsset__memoized?: (asset: string) => Promise<string>;
    public getLockAsset = async (asset_: string): Promise<string> => {
        this._getLockAsset__memoized =
            this._getLockAsset__memoized ||
            utils.memoize(
                async (asset: string): Promise<string> =>
                    await getLockAsset(this.network, this.provider, asset),
            );
        return this._getLockAsset__memoized(asset_);
    };

    private _getLockGateway__memoized?: (asset: string) => Promise<string>;
    public getLockGateway = async (asset_: string): Promise<string> => {
        this._getLockGateway__memoized =
            this._getLockGateway__memoized ||
            utils.memoize(
                async (asset: string): Promise<string> =>
                    await getLockGateway(this.network, this.provider, asset),
            );
        return this._getLockGateway__memoized(asset_);
    };

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

    /** @deprecated Replace with `utils.toURLBase64(txHashToBytes(txHash))`. */
    public txidFormattedToTxid = (txHash: string): string => {
        return utils.toURLBase64(txHashToBytes(txHash));
    };

    /** @deprecated Replace with `txHashFromBytes(utils.fromBase64(txid))`. */
    public txidToTxidFormatted = ({ txid }: { txid: string }): string => {
        return txHashFromBytes(utils.fromBase64(txid));
    };

    public transactionExplorerLink = ({
        txid,
        txHash,
        txidFormatted,
    }: Partial<ChainTransaction> &
        ({ txid: string } | { txHash: string } | { txidFormatted: string })):
        | string
        | undefined => {
        const txHashOrTxHashFormatted = txHash || txidFormatted;
        if (txHashOrTxHashFormatted) {
            return this.explorer.transaction(txHashOrTxHashFormatted);
        } else if (txid) {
            return this.explorer.transaction(
                this.txidToTxidFormatted({ txid }),
            );
        }
        return undefined;
    };

    public withProvider = (web3Provider: EthProvider): this => {
        this.provider = Provider.isProvider(web3Provider)
            ? web3Provider
            : typeof web3Provider === "string"
            ? new ethers.providers.JsonRpcProvider(web3Provider)
            : // TODO: Set chain ID instead of "any"?
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

    public checkProviderNetwork = async (): Promise<void> => {
        const actualChainID = (await this.provider.getNetwork()).chainId;
        const expectedChainID = new BigNumber(
            this.network.config.chainId,
        ).toNumber();
        const wrongNetwork = actualChainID !== expectedChainID;
        if (wrongNetwork) {
            throw new Error(
                `${this.chain} provider connected to wrong network: expected ${expectedChainID}, got ${actualChainID}.`,
            );
        }
    };

    public getOutputPayload = async (
        asset: string,
        inputType: InputType,
        outputType: OutputType,
        contractCall: EVMPayload,
    ): Promise<{
        to: string;
        toBytes: Uint8Array;
        payload: Uint8Array;
    }> => {
        await this.checkProviderNetwork();
        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler.getPayload) {
            throw ErrorWithCode.updateError(
                new Error(
                    `'${contractCall.type}' payload type can only be used as a setup payload.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }

        return await handler.getPayload({
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
    };

    // Supported assets

    /** Return true if the asset originates from the chain. */

    private _isLockAsset__memoized?: (assetSymbol: string) => Promise<boolean>;
    // Wrapper to expose _isLockAsset as a class method instead of a property
    public isLockAsset = async (assetSymbol_: string): Promise<boolean> => {
        this._isLockAsset__memoized =
            this._isLockAsset__memoized ||
            utils.memoize(async (assetSymbol: string): Promise<boolean> => {
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
            });
        return this._isLockAsset__memoized(assetSymbol_);
    };

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
    private _isMintAsset__memoized?: (asset_: string) => Promise<boolean>;
    public isMintAsset = async (asset_: string): Promise<boolean> => {
        this._isMintAsset__memoized =
            this._isMintAsset__memoized ||
            utils.memoize(async (asset: string): Promise<boolean> => {
                // Check that there's a gateway contract for the asset.
                try {
                    return (await this.getMintAsset(asset)) !== undefined;
                } catch (error: unknown) {
                    // Check that the error isn't caused by being on the wrong network.
                    await this.checkProviderNetwork();
                    if (
                        error instanceof Error &&
                        /(Empty address returned)|(not supported)/.exec(
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            String((error || {}).message),
                        )
                    ) {
                        // Ignore
                    } else {
                        console.warn(error);
                    }
                    return false;
                }
            });
        return this._isMintAsset__memoized(asset_);
    };

    /**
     * `assetDecimals` should return the number of decimals of the asset.
     *
     * If the asset is not supported, an error should be thrown.
     *
     */
    private _assetDecimals__memoized?: (asset_: string) => Promise<number>;
    public assetDecimals = async (asset_: string): Promise<number> => {
        this._assetDecimals__memoized =
            this._assetDecimals__memoized ||
            utils.memoize(
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
        return this._assetDecimals__memoized(asset_);
    };

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
            this.txidToTxidFormatted(transaction),
        );
        if (receipt === null) {
            throw ErrorWithCode.updateError(
                new Error(
                    `${String(
                        transaction.chain,
                    )} transaction not found: ${String(
                        transaction.txHash || transaction.txidFormatted,
                    )}`,
                ),
                RenJSError.TRANSACTION_NOT_FOUND,
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
                    `Must connect ${this.chain} signer or provider address.`,
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
        contractCall: EVMPayload,
        getParams: () => {
            pHash: Uint8Array;
            nHash: Uint8Array;
            amount?: BigNumber;
            sigHash?: Uint8Array;
            signature?: Uint8Array;
        },
        confirmationTarget: number,
    ): Promise<TxSubmitter | TxWaiter> => {
        await this.checkProviderNetwork();

        const findExistingTransaction = async (): Promise<
            ChainTransaction | undefined
        > => {
            const { nHash, sigHash } = getParams();
            if (outputType === OutputType.Release) {
                return await findReleaseBySigHash(
                    this.network,
                    this.provider,
                    asset,
                    nHash,
                    this.network.logRequestLimit,
                );
            } else {
                return await findMintBySigHash(
                    this.network,
                    this.provider,
                    asset,
                    nHash,
                    sigHash,
                    this.network.logRequestLimit,
                );
            }
            return undefined;
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

        if (!this.signer) {
            throw ErrorWithCode.updateError(
                new Error(`Must connect signer.`),
                RenJSError.PARAMETER_ERROR,
            );
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
        contractCall: EVMPayload,
        getParams: () => {
            toChain: string;
            toPayload: {
                to: string;
                payload: Uint8Array;
            };
            gatewayAddress?: string;
        },
        confirmationTarget: number,
        onInput: (input: InputChainTransaction) => void,
    ): Promise<TxSubmitter | TxWaiter> => {
        await this.checkProviderNetwork();

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
                        mapBurnLogToInputChainTransaction(this.chain, asset, e),
                    )
                    .map(onInput);

                // Filter logs that are releases to other chains.
                const { toChain } = getParams();
                const filterByRecipientChain = (e: LogBurnToChainEvent) => {
                    const [_recipientAddress, recipientChain] = e.args;
                    return recipientChain === toChain;
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
                            e,
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
                    mapLockLogToInputChainTransaction(this.chain, asset, e),
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
                    mapTransferLogToInputChainTransaction(this.chain, asset, e),
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
                        await this.provider.getTransactionReceipt(
                            (tx.txHash || tx.txidFormatted) as string,
                        ),
                    );
                },
            });
        }

        if (!this.signer) {
            throw ErrorWithCode.updateError(
                new Error(`Must connect signer.`),
                RenJSError.PARAMETER_ERROR,
            );
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
                    inputType,
                    getParams(),
                ),
            onReceipt: onReceipt,
        });
    };

    public getInSetup = async (
        asset: string,
        inputType: InputType,
        outputType: OutputType,
        contractCall: EVMPayload,
        getParams: () => {
            toChain: string;
            toPayload: {
                to: string;
                toBytes: Uint8Array;
                payload: Uint8Array;
            };
            gatewayAddress?: string;
        },
    ): Promise<{ [key: string]: EVMTxSubmitter | TxWaiter }> => {
        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler || !handler.getSetup) {
            return {};
        }
        if (!this.signer) {
            throw ErrorWithCode.updateError(
                new Error(`Must connect signer.`),
                RenJSError.PARAMETER_ERROR,
            );
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
                });
            }
        }
        return txSubmitted;
    };

    public getOutSetup = async (
        asset: string,
        inputType: InputType,
        outputType: OutputType,
        contractCall: EVMPayload,
        getParams: () => {
            pHash: Uint8Array;
            nHash: Uint8Array;
            amount?: BigNumber;
            sigHash?: Uint8Array;
            signature?: Uint8Array;
        },
    ): Promise<{ [key: string]: EVMTxSubmitter | TxWaiter }> => {
        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler || !handler.getSetup) {
            return {};
        }
        if (!this.signer) {
            throw ErrorWithCode.updateError(
                new Error(`Must connect signer.`),
                RenJSError.PARAMETER_ERROR,
            );
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
                });
            }
        }
        return txSubmitted;
    };

    private getPayloadHandler = (payloadType: string): PayloadHandler => {
        switch (payloadType) {
            case "approval":
                return approvalPayloadHandler as PayloadHandler<EVMPayload>;
            case "contract":
                return contractPayloadHandler as PayloadHandler<EVMPayload>;
            case "address":
                return accountPayloadHandler as PayloadHandler<EVMPayload>;
            case "transaction":
                return txPayloadHandler as PayloadHandler<EVMPayload>;
        }

        // TODO: Allow adding custom payload handlers.

        throw new Error(`Unknown payload type ${payloadType}`);
    };

    public createGatewayAddress = (
        _asset: string,
        fromPayload: EVMPayload,
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
                        new Error(`Must connect signer.`),
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
                        return undefined;
                    }
                    throw error;
                }
            },
            [EVMParam.EVM_ACCOUNT_IS_CONTRACT]: async () => {
                if (!this.signer) {
                    throw ErrorWithCode.updateError(
                        new Error(`Must connect signer.`),
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
                        return undefined;
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

            // Available when minting or releasing
            [EVMParam.EVM_AMOUNT]: utils.isDefined(params.amount)
                ? params.amount.toString()
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

    /* ====================================================================== */

    public Account = ({
        account,
        amount,
        convertToWei,
        convertUnit,
        anyoneCanSubmit,
        infiniteApproval,
    }: {
        account?: string;
        amount?: BigNumber | string | number;
        /**
         * @deprecated - renamed to `convertUnit`
         */
        convertToWei?: boolean;
        convertUnit?: boolean;
        anyoneCanSubmit?: boolean;
        infiniteApproval?: boolean;
    } = {}): EVMPayload => {
        assertType<BigNumber | string | number | undefined>(
            "BigNumber | string | number | undefined",
            { amount },
        );
        assertType<boolean | undefined>("boolean | undefined", {
            convertToWei,
            convertUnit,
        });
        convertUnit = convertToWei || convertUnit;

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
        };
    };

    public Address = (address: string): EVMPayload => {
        assertType<string>("string", {
            address,
        });

        if (address.slice(0, 5) !== "__EVM") {
            if (!this.validateAddress(address)) {
                throw ErrorWithCode.updateError(
                    new Error(
                        `Invalid ${this.chain} address: ${String(address)}`,
                    ),
                    RenJSError.PARAMETER_ERROR,
                );
            }
        }

        return {
            chain: this.chain,
            type: "address",
            params: {
                address,
                anyoneCanSubmit: true,
            },
        };
    };

    public Contract = (params: {
        to: string;
        method: string;
        params: EthArg[];
        withRenParams: boolean;
        txConfig?: ethers.PayableOverrides;
    }): EVMPayload => {
        return {
            chain: this.chain,
            type: "contract",
            params: {
                to: params.to,
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
            ({ txid: string } | { txHash: string } | { txidFormatted: string }),
    ): EVMPayload => {
        return {
            chain: this.chain,
            type: "transaction",
            params: {
                tx: populateChainTransaction({
                    partialTx,
                    chain: this.chain,
                    txHashToBytes,
                    txHashFromBytes,
                    defaultTxindex: "0",
                }),
            },
        };
    };
}
