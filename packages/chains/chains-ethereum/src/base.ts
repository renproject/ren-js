import BigNumber from "bignumber.js";
import elliptic from "elliptic";
import { ethers } from "ethers";
import { computeAddress } from "ethers/lib/utils";

import {
    ExternalProvider,
    JsonRpcFetchFunc,
    Web3Provider,
} from "@ethersproject/providers";
import {
    assertType,
    ChainTransaction,
    ContractChain,
    DefaultTxWaiter,
    ErrorWithCode,
    InputChainTransaction,
    InputType,
    Logger,
    nullLogger,
    OutputType,
    RenJSError,
    TxSubmitter,
    TxWaiter,
    utils,
} from "@renproject/utils";

import {
    findABIMethod,
    getGatewayRegistryInstance,
    LockGatewayABI,
    MintGatewayABI,
    TransferWithLogABI,
} from "./contracts";
import { LogLockToChainEvent } from "./contracts/typechain/LockGatewayV3";
import { LogBurnEvent } from "./contracts/typechain/MintGatewayV3";
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
    mapLockLogToInputChainTransaction,
    mapTransferLogToInputChainTransaction,
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
    PayloadHandler,
} from "./utils/payloads/evmPayloadHandlers";
import {
    EthereumClassConfig,
    EthProvider,
    EthSigner,
    EvmNetworkConfig,
} from "./utils/types";
import { EvmExplorer, StandardEvmExplorer } from "./utils/utils";

export class EthereumBaseChain
    implements ContractChain<EVMPayload, EVMPayload>
{
    public static chain = "Ethereum";
    public chain: string;

    public nativeAsset: {
        name: string;
        symbol: string;
        decimals: number;
    };
    public assets: { [asset: string]: string } = {};

    public provider: Web3Provider;
    public signer?: EthSigner;
    public network: EvmNetworkConfig;
    public explorer: EvmExplorer;

    private _logger: Logger;

    public constructor({
        network,
        provider,
        signer,
        config,
    }: {
        network: EvmNetworkConfig;
        provider: EthProvider;
        signer?: EthSigner;
        config?: EthereumClassConfig;
    }) {
        this.network = network;
        this.chain = this.network.selector;
        this.nativeAsset = this.network.network.nativeCurrency;
        this.explorer = StandardEvmExplorer(
            this.network.network.blockExplorerUrls[0],
        );
        this._logger = (config && config.logger) || nullLogger;

        // Ignore not configured error.
        this.provider = undefined as never;
        this.withProvider(provider);
        if (signer) {
            this.withSigner(signer);
        }
    }

    private _getMintAsset__memoized?: (asset: string) => Promise<string>;
    public async getMintAsset(asset: string): Promise<string> {
        this._getMintAsset__memoized =
            this._getMintAsset__memoized ||
            utils.memoize(
                async (asset: string): Promise<string> =>
                    await getRenAsset(this.network, this.provider, asset),
            );
        return this._getMintAsset__memoized(asset);
    }

    private _getMintGateway__memoized?: (asset: string) => Promise<string>;
    public async getMintGateway(asset_: string): Promise<string> {
        this._getMintGateway__memoized =
            this._getMintGateway__memoized ||
            utils.memoize(
                async (asset: string): Promise<string> =>
                    await getMintGateway(this.network, this.provider, asset),
            );
        return this._getMintGateway__memoized(asset_);
    }

    private _getLockAsset__memoized?: (asset: string) => Promise<string>;
    public async getLockAsset(asset_: string): Promise<string> {
        this._getLockAsset__memoized =
            this._getLockAsset__memoized ||
            utils.memoize(
                async (asset: string): Promise<string> =>
                    await getLockAsset(this.network, this.provider, asset),
            );
        return this._getLockAsset__memoized(asset_);
    }

    private _getLockGateway__memoized?: (asset: string) => Promise<string>;
    public async getLockGateway(asset_: string): Promise<string> {
        this._getLockGateway__memoized =
            this._getLockGateway__memoized ||
            utils.memoize(
                async (asset: string): Promise<string> =>
                    await getLockGateway(this.network, this.provider, asset),
            );
        return this._getLockGateway__memoized(asset_);
    }

    public validateAddress = validateAddress;
    public validateTransaction = validateTransaction;
    public addressExplorerLink(address: string): string {
        return this.explorer.address(address);
    }

    public formattedTransactionHash(transaction: {
        txid: string;
        txindex: string;
    }): string {
        return utils.Ox(utils.fromBase64(transaction.txid));
    }

    public transactionExplorerLink(transaction: ChainTransaction): string {
        return this.explorer.transaction(
            this.formattedTransactionHash(transaction),
        );
    }

    public withProvider(web3Provider: EthProvider): this {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.provider = (web3Provider as any)._isProvider
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (web3Provider as any)
            : new ethers.providers.Web3Provider(
                  web3Provider as ExternalProvider | JsonRpcFetchFunc,
              );
        if (!this.signer) {
            try {
                this.signer = this.provider.getSigner();
            } catch (error) {}
        } else {
            try {
                this.signer.connect(this.provider);
            } catch (error) {
                // Ignore - doesnt' work on all signers.
                // e.g. JsonRpc signer throws:
                // `cannot alter JSON-RPC Signer connection`.
            }
        }
        return this;
    }

    public withSigner(signer: EthSigner): this {
        this.signer = signer;
        try {
            this.signer.connect(this.provider);
        } catch (error) {
            // Ignore - doesnt' work on all signers.
            // e.g. JsonRpc signer throws:
            // `cannot alter JSON-RPC Signer connection`.
        }
        return this;
    }

    public async getOutputPayload(
        asset: string,
        type: OutputType,
        contractCall: EVMPayload,
    ): Promise<{
        to: string;
        toBytes: Buffer;
        payload: Buffer;
    }> {
        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler.getPayload) {
            throw ErrorWithCode.from(
                new Error(
                    `'${contractCall.type}' payload type can only be used as a setup payload.`,
                ),
                RenJSError.PARAMETER_ERROR,
            );
        }
        return await handler.getPayload(
            this.network,
            this.signer,
            contractCall,
            this.getEVMParams(asset, type, {}),
            this.getPayloadHandler,
        );
    }

    // Supported assets

    /** Return true if the asset originates from the chain. */

    private _isLockAsset__memoized?: (assetSymbol: string) => Promise<boolean>;
    // Wrapper to expose _isLockAsset as a class method instead of a property
    public async isLockAsset(assetSymbol_: string): Promise<boolean> {
        this._isLockAsset__memoized =
            this._isLockAsset__memoized ||
            utils.memoize(async (assetSymbol: string): Promise<boolean> => {
                // Check if it in the list of hard-coded assets.
                if (
                    Object.keys(this.assets).includes(assetSymbol) ||
                    assetSymbol === this.network.asset
                ) {
                    return true;
                }

                // Check if the asset has an associated lock-gateway.
                try {
                    if (await this.getLockAsset(assetSymbol)) {
                        return true;
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (error: any) {
                    return false;
                }

                return false;
            });
        return this._isLockAsset__memoized(assetSymbol_);
    }

    public isDepositAsset(assetSymbol: string): boolean {
        return assetSymbol === this.network.asset;
    }

    /**
     * `assetIsSupported` should return true if the asset is native to the
     * MintChain.
     *
     * ```ts
     * ethereum.assetIsSupported = asset => asset === "ETH";
     * ```
     */
    private _isMintAsset__memoized?: (asset_: string) => Promise<boolean>;
    public async isMintAsset(asset_: string): Promise<boolean> {
        this._isMintAsset__memoized =
            this._isMintAsset__memoized ||
            utils.memoize(async (asset: string): Promise<boolean> => {
                // Check that there's a gateway contract for the asset.
                try {
                    return (await this.getMintAsset(asset)) !== undefined;
                } catch (error: unknown) {
                    if (
                        error instanceof Error &&
                        /(Empty address returned)|(Asset not supported on mint-chain)/.exec(
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
    }

    /**
     * `assetDecimals` should return the number of decimals of the asset.
     *
     * If the asset is not supported, an error should be thrown.
     *
     */
    private _assetDecimals__memoized?: (asset_: string) => Promise<number>;
    public async assetDecimals(asset_: string): Promise<number> {
        this._assetDecimals__memoized =
            this._assetDecimals__memoized ||
            utils.memoize(
                async (asset: string): Promise<number> => {
                    // TODO: get lock asset decimals

                    if (asset === this.network.asset) {
                        return this.nativeAsset.decimals;
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
    }

    public async transactionConfidence(
        transaction: ChainTransaction,
    ): Promise<BigNumber> {
        if (transaction.txid === "") {
            throw new Error(
                `Unable to fetch transaction confidence, transaction hash not set.`,
            );
        }
        const currentBlock = new BigNumber(
            (await this.provider.getBlockNumber()).toString(),
        );
        const receipt = await this.provider.getTransactionReceipt(
            this.formattedTransactionHash(transaction),
        );
        if (receipt === null) {
            throw ErrorWithCode.from(
                new Error(
                    `${String(
                        transaction.chain,
                    )} transaction not found: ${String(
                        transaction.txidFormatted,
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
    }

    public async getBalance(
        asset: string,
        address?: string,
    ): Promise<BigNumber> {
        if (!address) {
            if (!this.signer) {
                throw new Error(
                    `Must connect ${this.chain} signer or provider address.`,
                );
            }
            address = address || (await this.signer.getAddress());
        }

        if (asset === this.network.asset) {
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
    }

    public async getOutputTx(
        type: OutputType,
        asset: string,
        contractCall: EVMPayload,
        getParams: () => {
            pHash: Buffer;
            nHash: Buffer;
            amount?: BigNumber;
            sigHash?: Buffer;
            signature?: Buffer;
        },
        confirmationTarget: number,
    ): Promise<TxSubmitter | TxWaiter> {
        const findExistingTransaction = async (): Promise<
            ChainTransaction | undefined
        > => {
            const { nHash, sigHash } = getParams();
            if (type === OutputType.Release) {
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

        if (!this.signer) {
            throw ErrorWithCode.from(
                new Error(`Must connect signer.`),
                RenJSError.PARAMETER_ERROR,
            );
        }

        return new EVMTxSubmitter({
            signer: this.signer,
            network: this.network,
            chain: this.chain,
            payload: contractCall,
            target: confirmationTarget,
            getPayloadHandler: this.getPayloadHandler,
            getParams: () => this.getEVMParams(asset, type, getParams()),
            findExistingTransaction,
        });
    }

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    public getInputTx(
        type: InputType,
        asset: string,
        contractCall: EVMPayload,
        getParams: () => {
            toChain: string;
            toPayload: {
                to: string;
                payload: Buffer;
            };
            gatewayAddress?: string;
        },
        confirmationTarget: number,
        onInput: (input: InputChainTransaction) => void,
    ): TxSubmitter | TxWaiter {
        // if (!transaction && burnNonce) {
        //     const nonceBuffer = Buffer.isBuffer(burnNonce)
        //         ? Buffer.from(burnNonce)
        //         : new BN(burnNonce).toArrayLike(Buffer, "be", 32);

        //     return [
        //         await findBurnByNonce(
        //             this.renNetworkDetails,
        //             this.provider,
        //             asset,
        //             nonceBuffer,
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
        //     this.formattedTransactionHash(transaction),
        //     this.logger,
        //     config.networkDelay,
        // );

        // return extractBurnDetails(receipt);

        if (!this.signer) {
            throw ErrorWithCode.from(
                new Error(`Must connect signer.`),
                RenJSError.PARAMETER_ERROR,
            );
        }

        const onReceipt = (receipt: ethers.providers.TransactionReceipt) => {
            if (type === InputType.Burn) {
                const logBurnABI = findABIMethod(MintGatewayABI, "LogBurn");
                filterLogs<LogBurnEvent>(receipt.logs, logBurnABI)
                    .map((e) =>
                        mapBurnLogToInputChainTransaction(this.chain, asset, e),
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

        return new EVMTxSubmitter({
            signer: this.signer,
            network: this.network,
            chain: this.chain,
            payload: contractCall,
            target: confirmationTarget,
            getPayloadHandler: this.getPayloadHandler,
            getParams: () => this.getEVMParams(asset, type, getParams()),
            onReceipt: onReceipt,
        });
    }

    public async getInSetup(
        asset: string,
        type: InputType,
        contractCall: EVMPayload,
        getParams: () => {
            toChain: string;
            toPayload: {
                to: string;
                toBytes: Buffer;
                payload: Buffer;
            };
            gatewayAddress?: string;
        },
    ): Promise<{ [key: string]: EVMTxSubmitter }> {
        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler || !handler.getSetup) {
            return {};
        }
        if (!this.signer) {
            throw ErrorWithCode.from(
                new Error(`Must connect signer.`),
                RenJSError.PARAMETER_ERROR,
            );
        }
        const calls = await handler.getSetup(
            this.network,
            this.signer,
            contractCall,
            this.getEVMParams(asset, type, getParams()),
            this.getPayloadHandler,
        );

        const txSubmitted: { [key: string]: EVMTxSubmitter } = {};
        for (const callKey of Object.keys(calls)) {
            txSubmitted[callKey] = new EVMTxSubmitter({
                signer: this.signer,
                network: this.network,
                chain: this.chain,
                payload: calls[callKey],
                target: 1,
                getPayloadHandler: this.getPayloadHandler,
                getParams: () => this.getEVMParams(asset, type, getParams()),
            });
        }
        return txSubmitted;
    }

    public async getOutSetup(
        asset: string,
        type: OutputType,
        contractCall: EVMPayload,
        getParams: () => {
            pHash: Buffer;
            nHash: Buffer;
            amount?: BigNumber;
            sigHash?: Buffer;
            signature?: Buffer;
        },
    ): Promise<{ [key: string]: EVMTxSubmitter }> {
        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler || !handler.getSetup) {
            return {};
        }
        if (!this.signer) {
            throw ErrorWithCode.from(
                new Error(`Must connect signer.`),
                RenJSError.PARAMETER_ERROR,
            );
        }
        const calls = await handler.getSetup(
            this.network,
            this.signer,
            contractCall,
            this.getEVMParams(asset, type, getParams()),
            this.getPayloadHandler,
        );

        const txSubmitted: { [key: string]: EVMTxSubmitter } = {};
        for (const callKey of Object.keys(calls)) {
            txSubmitted[callKey] = new EVMTxSubmitter({
                signer: this.signer,
                network: this.network,
                chain: this.chain,
                payload: calls[callKey],
                target: 1,
                getPayloadHandler: this.getPayloadHandler,
                getParams: () => this.getEVMParams(asset, type, getParams()),
            });
        }
        return txSubmitted;
    }

    private getPayloadHandler = (payloadType: string): PayloadHandler => {
        switch (payloadType) {
            case "approval":
                return approvalPayloadHandler as PayloadHandler<// eslint-disable-next-line @typescript-eslint/no-explicit-any
                EVMPayload>;
            case "contract":
                return contractPayloadHandler as PayloadHandler<// eslint-disable-next-line @typescript-eslint/no-explicit-any
                EVMPayload>;
            case "address":
                return accountPayloadHandler as PayloadHandler<// eslint-disable-next-line @typescript-eslint/no-explicit-any
                EVMPayload>;
        }

        // TODO: Allow adding custom payload handlers.

        throw new Error(`Unknown payload type ${payloadType}`);
    };

    public createGatewayAddress(
        _asset: string,
        fromPayload: EVMPayload,
        shardPublicKey: Buffer,
        gHash: Buffer,
    ): Promise<string> | string {
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
            Buffer.from(derivedPublicKey.getPublic(false, "hex"), "hex"),
        );
    }

    private getEVMParams(
        asset: string,
        type: InputType | OutputType | "setup",
        params: {
            // Input
            toChain?: string;
            toPayload?: {
                to: string;
                payload: Buffer;
            };
            gatewayAddress?: string;

            // Output
            pHash?: Buffer;
            amount?: BigNumber;
            nHash?: Buffer;
            sigHash?: Buffer;
            signature?: Buffer;
        },
    ): EVMParamValues {
        return {
            // Always available
            [EVMParam.EVM_TRANSACTION_TYPE]: type,
            [EVMParam.EVM_TOKEN_ADDRESS]: async () => {
                if (type === InputType.Lock || type === OutputType.Release) {
                    return await this.getLockAsset(asset);
                } else {
                    return await this.getMintAsset(asset);
                }
            },
            [EVMParam.EVM_TOKEN_DECIMALS]: async () =>
                await this.assetDecimals(asset),
            [EVMParam.EVM_ACCOUNT]: async () => {
                if (!this.signer) {
                    throw ErrorWithCode.from(
                        new Error(`Must connect signer.`),
                        RenJSError.PARAMETER_ERROR,
                    );
                }
                return this.signer.getAddress();
            },
            [EVMParam.EVM_ACCOUNT_IS_CONTRACT]: async () => {
                if (!this.signer) {
                    throw ErrorWithCode.from(
                        new Error(`Must connect signer.`),
                        RenJSError.PARAMETER_ERROR,
                    );
                }
                const account = await this.signer.getAddress();
                const codeString = await this.provider.getCode(account);
                return utils.fromHex(codeString).length > 0;
            },
            [EVMParam.EVM_GATEWAY]: async () => {
                if (type === InputType.Lock || type === OutputType.Release) {
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
                ? Buffer.from(params.toPayload.to)
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
    }

    /* ====================================================================== */

    public Account({
        amount,
        convertToWei,
    }: {
        amount?: BigNumber | string | number;
        convertToWei?: boolean;
    } = {}): EVMPayload {
        assertType<BigNumber | string | number | undefined>(
            "BigNumber | string | number | undefined",
            { amount },
        );
        assertType<boolean | undefined>("boolean | undefined", {
            convertToWei,
        });

        let fixedAmount;
        if (utils.isDefined(amount)) {
            fixedAmount = BigNumber.isBigNumber(amount)
                ? amount
                : new BigNumber(amount.toString());
            if (fixedAmount.isNaN()) {
                throw ErrorWithCode.from(
                    new Error(
                        `Invalid numeric-value 'amount'. (amount: ${amount.toString()})`,
                    ),
                    RenJSError.PARAMETER_ERROR,
                );
            } else if (!convertToWei && fixedAmount.decimalPlaces() !== 0) {
                throw ErrorWithCode.from(
                    new Error(
                        `Amount must be provided in Wei as an integer, or 'convertToWei' must be set to 'true'. (amount: ${amount.toString()})`,
                    ),
                    RenJSError.PARAMETER_ERROR,
                );
            }
        }
        return {
            chain: this.chain,
            type: "address",
            params: {
                address: EVMParam.EVM_ACCOUNT,
                amount: fixedAmount ? fixedAmount.toFixed() : undefined,
                convertToWei,
            },
        };
    }

    public Address(address: string): EVMPayload {
        assertType<string>("string", {
            address,
        });

        return {
            chain: this.chain,
            type: "address",
            params: {
                address,
            },
        };
    }

    public Contract(params: {
        to: string;
        method: string;
        params: EthArg[];
        withRenParams: boolean;
        txConfig?: ethers.PayableOverrides;
    }): EVMPayload {
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
                              },
                              {
                                  name: "nHash",
                                  type: "bytes32",
                                  value: EVMParam.EVM_NHASH,
                                  notInPayload: true,
                              },
                              {
                                  name: "signature",
                                  type: "bytes",
                                  value: EVMParam.EVM_SIGNATURE,
                                  notInPayload: true,
                              },
                          ]
                        : []),
                ],
                txConfig: params.txConfig,
            },
        };
    }

    // /** @category Main */
    // public Address = (address: string): OutputContractCall => ({
    //     chain: this.chain,
    //     getPayload: async (asset: string, type: OutputType) => {
    //         switch (type) {
    //             case OutputType.Mint:
    //                 return {
    //                     to: this.network.addresses.BasicBridge,
    //                     method: "mint",
    //                     values: [
    //                         {
    //                             type: "string",
    //                             name: "_symbol",
    //                             value: asset,
    //                         },
    //                         {
    //                             type: "address",
    //                             name: "recipient_",
    //                             value: address,
    //                         },
    //                     ],
    //                 };
    //             case OutputType.Release:
    //                 if (!this.signer) {
    //                     throw new Error(`Must connect signer.`);
    //                 }
    //                 return {
    //                     to: await this.signer.getAddress(),
    //                     method: "release",
    //                     values: [],
    //                 };
    //         }
    //     },
    //     getContractCall: async (
    //         asset: string,
    //         type: OutputType,
    //         pHash: Buffer,
    //         amount: string,
    //         nHash: Buffer,
    //         signature: Buffer,
    //     ) => {
    //         switch (type) {
    //             case OutputType.Mint:
    //                 return {
    //                     to: this.network.addresses.BasicBridge,
    //                     method: "mint",
    //                     values: [
    //                         {
    //                             type: "string",
    //                             name: "_symbol",
    //                             value: asset,
    //                         },
    //                         {
    //                             type: "address",
    //                             name: "recipient_",
    //                             value: address,
    //                         },
    //                         {
    //                             name: "amount",
    //                             type: "uint256",
    //                             value: amount,
    //                         },
    //                         {
    //                             name: "nHash",
    //                             type: "bytes32",
    //                             value: nHash,
    //                         },
    //                         {
    //                             name: "signature",
    //                             type: "bytes",
    //                             value: signature,
    //                         },
    //                     ],
    //                 };
    //             case OutputType.Release:
    //                 return {
    //                     to: await this.getLockGateway(asset),
    //                     method: "release",
    //                     values: [
    //                         {
    //                             name: "pHash",
    //                             type: "bytes32",
    //                             value: pHash,
    //                         },
    //                         {
    //                             name: "amount",
    //                             type: "uint256",
    //                             value: amount,
    //                         },
    //                         {
    //                             name: "nHash",
    //                             type: "bytes32",
    //                             value: nHash,
    //                         },
    //                         {
    //                             name: "signature",
    //                             type: "bytes",
    //                             value: signature,
    //                         },
    //                     ],
    //                 };
    //         }
    //     },
    // });
}
