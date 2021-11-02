import BigNumber from "bignumber.js";
import { Contract, PayableOverrides, providers, Signer } from "ethers";

import {
    ExternalProvider,
    JsonRpcFetchFunc,
    Web3Provider,
} from "@ethersproject/providers";
import {
    ChainTransaction,
    ContractChain,
    DefaultTxWaiter,
    fromBase64,
    InputChainTransaction,
    InputType,
    isDefined,
    Logger,
    nullLogger,
    OutputType,
    Ox,
    RenJSError,
    TxSubmitter,
    TxWaiter,
    withCode,
} from "@renproject/utils";

import {
    BasicBridgeABI,
    findABIMethod,
    LockGatewayABI,
    MintGatewayABI,
} from "./contracts";
import { LogTransferredEvent } from "./contracts/typechain/BasicBridge";
import { LogLockToChainEvent } from "./contracts/typechain/LockGatewayV3";
import { LogBurnEvent } from "./contracts/typechain/MintGatewayV3";
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
    ContractCall,
    EthereumClassConfig,
    EthProvider,
    EthProviderUpdate,
    EvmNetworkConfig,
    InputContractCall,
    OutputContractCall,
} from "./utils/types";
import { EvmExplorer, StandardEvmExplorer } from "./utils/utils";

export class EthereumBaseChain
    implements ContractChain<EVMPayload, EVMPayload>
{
    // DepositChain<ContractCall, ContractCall>
    public static chain = "Ethereum";
    public chain: string;
    public assets: { [asset: string]: string } = {};

    public provider: Web3Provider;
    public signer: Signer | undefined;
    public network: EvmNetworkConfig;
    public explorer: EvmExplorer;
    public logger: Logger;

    public getRenAsset = async (asset: string): Promise<string> =>
        await getRenAsset(this.network, this.provider, asset);
    public getMintGateway = async (asset: string): Promise<string> =>
        await getMintGateway(this.network, this.provider, asset);
    public getLockAsset = async (asset: string): Promise<string> =>
        await getLockAsset(this.network, this.provider, asset);
    public getLockGateway = async (asset: string): Promise<string> =>
        await getLockGateway(this.network, this.provider, asset);

    constructor(
        network: EvmNetworkConfig,
        web3Provider: EthProvider,
        config: EthereumClassConfig = {},
    ) {
        this.network = network;
        this.chain = this.network.selector;
        this.explorer = StandardEvmExplorer(
            this.network.network.blockExplorerUrls[0],
        );
        this.logger = config.logger || nullLogger;

        // Ignore not configured error.
        this.provider = undefined as never;
        this.withProvider(web3Provider);
    }

    public validateAddress = validateAddress;
    public validateTransaction = validateTransaction;
    public addressExplorerLink = (address: string): string =>
        this.explorer.address(address);

    public transactionHash = (transaction: {
        txid: string;
        txindex: string;
    }): string => Ox(fromBase64(transaction.txid));

    public transactionExplorerLink = (transaction: ChainTransaction): string =>
        this.explorer.transaction(this.transactionHash(transaction));

    public withProvider = (web3Provider: EthProviderUpdate) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((web3Provider as any).signer || (web3Provider as any).provider) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.provider = (web3Provider as any).provider || this.provider;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.signer = (web3Provider as any).signer || this.signer;
            if (this.signer) {
                this.signer.connect(this.provider);
            }
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const provider = (web3Provider as any)._isProvider
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (web3Provider as any)
                : new providers.Web3Provider(
                      web3Provider as ExternalProvider | JsonRpcFetchFunc,
                  );
            this.provider = provider;
            this.signer = provider.getSigner();
        }
        return this;
    };

    public getOutputPayload = async (
        asset: string,
        type: OutputType,
        contractCall: EVMPayload,
    ): Promise<{
        to: string;
        payload: Buffer;
    }> => {
        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler.getPayload) {
            throw withCode(
                new Error(
                    `'${contractCall.type}' payload type can only be used as a setup payload.`,
                ),
                RenJSError.INVALID_PARAMETERS,
            );
        }
        return handler.getPayload(
            this.network,
            this.signer,
            contractCall,
            this.getEVMParams(asset, type, {}),
            this.getPayloadHandler,
        );
    };

    // Supported assets

    /** Return true if the asset originates from the chain. */
    assetIsNative = async (asset: string): Promise<boolean> => {
        if (asset === "ETH") {
            return true;
        }

        try {
            if (await this.getLockGateway(asset)) {
                return true;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            return false;
        }

        return false;
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
        if (await this.assetIsNative(asset)) {
            return true;
        }

        // Check that there's a gateway contract for the asset.
        try {
            return !!(await this.getMintGateway(asset));
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
    };

    /**
     * `assetDecimals` should return the number of decimals of the asset.
     *
     * If the asset is not supported, an error should be thrown.
     *

     */
    assetDecimals = async (asset: string): Promise<number> => {
        // TODO: get lock asset decimals

        if (asset === "ETH") {
            return 18;
        }
        const tokenAddress = await this.getMintGateway(asset);

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

        const tokenContract = new Contract(
            tokenAddress,
            [decimalsABI],
            this.provider,
        );

        const decimalsRaw = await tokenContract.decimals();
        return new BigNumber(decimalsRaw.toString()).toNumber();
    };

    transactionConfidence = async (
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
            this.transactionHash(transaction),
        );
        if (receipt.blockNumber) {
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
                throw new Error(`Must connect signer or provider address.`);
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

        const tokenAddress = await this.getRenAsset(asset);

        const tokenContract = new Contract(
            tokenAddress,
            [balanceOfABI],
            this.provider,
        );

        const balanceRaw = await await tokenContract.balanceOf(address);

        return new BigNumber(balanceRaw.toString());
    };

    public lookupOutput = async (
        type: OutputType,
        asset: string,
        _contractCall: EVMPayload,
        renParams: {
            amount: BigNumber;
            sHash: Buffer;
            pHash: Buffer;
            nHash: Buffer;
        },
        confirmationTarget: number,
    ): Promise<TxWaiter | undefined> => {
        const { nHash } = renParams;

        let existingTransaction;
        if (type === OutputType.Release) {
            existingTransaction = await findReleaseBySigHash(
                this.network,
                this.provider,
                asset,
                nHash,
                this.network.logRequestLimit,
            );
        } else {
            existingTransaction = await findMintBySigHash(
                this.network,
                this.provider,
                asset,
                nHash,
                undefined,
                this.network.logRequestLimit,
            );
        }
        if (existingTransaction) {
            return new DefaultTxWaiter({
                chainTransaction: existingTransaction,
                chain: this,
                target: confirmationTarget,
            });
        }
        return undefined;
    };

    getOutputTx = async (
        type: OutputType,
        asset: string,
        contractCall: EVMPayload,
        getParams: () => {
            pHash: Buffer;
            amount: BigNumber;
            nHash: Buffer;
            sigHash?: Buffer;
            signature?: {
                r: Buffer;
                s: Buffer;
                v: number;
            };
        },
        confirmationTarget: number,
    ): Promise<TxSubmitter | TxWaiter> => {
        const { pHash, amount, nHash, sigHash, signature } = getParams();

        let existingTransaction;
        if (type === OutputType.Release) {
            existingTransaction = await findReleaseBySigHash(
                this.network,
                this.provider,
                asset,
                nHash,
                this.network.logRequestLimit,
            );
        } else {
            existingTransaction = await findMintBySigHash(
                this.network,
                this.provider,
                asset,
                nHash,
                sigHash,
                this.network.logRequestLimit,
            );
        }
        if (existingTransaction) {
            return new DefaultTxWaiter({
                chainTransaction: existingTransaction,
                chain: this,
                target: confirmationTarget,
            });
        }

        if (!signature) {
            throw new Error(`No signature provided.`);
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
            throw withCode(
                new Error(`Must connect signer.`),
                RenJSError.INVALID_PARAMETERS,
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
        });
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    getInputTx = async (
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
    ): Promise<TxSubmitter | TxWaiter> => {
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
        //     this.transactionHash(transaction),
        //     this.logger,
        //     config.networkDelay,
        // );

        // return extractBurnDetails(receipt);

        if (!this.signer) {
            throw withCode(
                new Error(`Must connect signer.`),
                RenJSError.INVALID_PARAMETERS,
            );
        }

        const onReceipt = (receipt: providers.TransactionReceipt) => {
            if (type === InputType.Burn) {
                const logBurnABI = findABIMethod(MintGatewayABI, "LogBurn");
                filterLogs<LogBurnEvent>(receipt.logs, logBurnABI)
                    .map((e) =>
                        mapBurnLogToInputChainTransaction(this.chain, e),
                    )
                    .map(onInput);
            } else {
                const logLockABI = findABIMethod(
                    LockGatewayABI,
                    "LogLockToChain",
                );
                filterLogs<LogLockToChainEvent>(receipt.logs, logLockABI)
                    .map((e) =>
                        mapLockLogToInputChainTransaction(this.chain, e),
                    )
                    .map(onInput);

                const logTransferredABI = findABIMethod(
                    BasicBridgeABI,
                    "LogTransferred",
                );
                filterLogs<LogTransferredEvent>(receipt.logs, logTransferredABI)
                    .map((e) =>
                        mapTransferLogToInputChainTransaction(this.chain, e),
                    )
                    .map(onInput);
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
    };

    public getInputSetup = async (
        asset: string,
        type: InputType,
        contractCall: EVMPayload,
    ) => {
        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler || !handler.getSetup) {
            return {};
        }
        if (!this.signer) {
            throw withCode(
                new Error(`Must connect signer.`),
                RenJSError.INVALID_PARAMETERS,
            );
        }
        const calls = handler.getSetup(
            this.network,
            this.signer,
            contractCall,
            this.getEVMParams(asset, type, {}),
            this.getPayloadHandler,
        );

        const txSubmitted = {};
        for (const callKey of Object.keys(calls)) {
            txSubmitted[callKey] = new EVMTxSubmitter({
                signer: this.signer,
                network: this.network,
                chain: this.chain,
                payload: calls[callKey],
                target: 1,
                getPayloadHandler: this.getPayloadHandler,
                getParams: () => this.getEVMParams(asset, type, {}),
            });
        }
        return txSubmitted;
    };

    public getOutputSetup = async (
        asset: string,
        type: OutputType,
        contractCall: EVMPayload,
    ) => {
        const handler = this.getPayloadHandler(contractCall.type);
        if (!handler || !handler.getSetup) {
            return {};
        }
        if (!this.signer) {
            throw withCode(
                new Error(`Must connect signer.`),
                RenJSError.INVALID_PARAMETERS,
            );
        }
        const calls = handler.getSetup(
            this.network,
            this.signer,
            contractCall,
            this.getEVMParams(asset, type, {}),
            this.getPayloadHandler,
        );

        const txSubmitted = {};
        for (const callKey of Object.keys(calls)) {
            txSubmitted[callKey] = new EVMTxSubmitter({
                signer: this.signer,
                network: this.network,
                chain: this.chain,
                payload: calls[callKey],
                target: 1,
                getPayloadHandler: this.getPayloadHandler,
                getParams: () => this.getEVMParams(asset, type, {}),
            });
        }
        return txSubmitted;
    };

    private getPayloadHandler = (payloadType: string): PayloadHandler => {
        switch (payloadType) {
            case "approval":
                return approvalPayloadHandler as PayloadHandler<
                    EVMPayload<string, any>
                >;
            case "contract":
                return contractPayloadHandler as PayloadHandler<
                    EVMPayload<string, any>
                >;
            case "account":
                return accountPayloadHandler as PayloadHandler<
                    EVMPayload<string, any>
                >;
        }

        // TODO: Allow adding custom payload handlers.

        throw new Error(`Unknown payload type ${payloadType}`);
    };

    private getEVMParams = (
        asset: string,
        type: InputType | OutputType | "setup",
        params: { [key: string]: any },
    ): EVMParamValues => {
        // Input
        // toChain: string;
        // toPayload: {
        //     to: string;
        //     payload: Buffer;
        // };
        // gatewayAddress?: string;

        // Output
        // pHash: Buffer;
        // amount: BigNumber;
        // nHash: Buffer;
        // sigHash?: Buffer;
        // signature?: {
        //     r: Buffer;
        //     s: Buffer;
        //     v: number;
        // };

        return {
            // Always available
            [EVMParam.EVM_TRANSACTION_TYPE]: type,
            [EVMParam.EVM_TOKEN_ADDRESS]: async () => {
                if (type === InputType.Lock || type === OutputType.Release) {
                    return await this.getLockAsset(asset);
                } else {
                    return await this.getRenAsset(asset);
                }
            },
            [EVMParam.EVM_ACCOUNT]: async () => {
                if (!this.signer) {
                    throw withCode(
                        new Error(`Must connect signer.`),
                        RenJSError.INVALID_PARAMETERS,
                    );
                }
                return this.signer?.getAddress();
            },
            [EVMParam.EVM_GATEWAY]: async () => {
                if (type === InputType.Lock || type === OutputType.Release) {
                    return await this.getLockGateway(asset);
                } else {
                    return await this.getMintGateway(asset);
                }
            },
            [EVMParam.EVM_ASSET]: asset,

            // Available when minting or releasing
            [EVMParam.EVM_AMOUNT]: isDefined(params.amount)
                ? params.amount.toString()
                : undefined, // in wei
            [EVMParam.EVM_NHASH]: params.nHash,
            [EVMParam.EVM_PHASH]: params.pHash,
            [EVMParam.EVM_SIGNATURE]: isDefined(params.signature)
                ? Buffer.concat([
                      params.signature.r,
                      params.signature.s,
                      Buffer.from([params.signature.v]),
                  ])
                : undefined,
            [EVMParam.EVM_SIGNATURE_R]: isDefined(params.signature)
                ? params.signature.r
                : undefined,
            [EVMParam.EVM_SIGNATURE_S]: isDefined(params.signature)
                ? params.signature.s
                : undefined,
            [EVMParam.EVM_SIGNATURE_V]: isDefined(params.signature)
                ? params.signature.v
                : undefined,

            // Available when locking or burning
            [EVMParam.EVM_TO_CHAIN]: params.toChain,
            [EVMParam.EVM_TO_ADDRESS]: isDefined(params.toPayload)
                ? Buffer.from(params.toPayload.to)
                : undefined,
            [EVMParam.EVM_TO_PAYLOAD]: isDefined(params.toPayload)
                ? params.toPayload.toPayload
                : undefined,
            [EVMParam.EVM_GATEWAY_DEPOSIT_ADDRESS]: params.gatewayAddress,
        };
    };

    /* ====================================================================== */

    public Account = (amount?: BigNumber | string | number): EVMPayload => ({
        chain: this.chain,
        type: "account",
        params: {
            amount: amount
                ? (BigNumber.isBigNumber(amount)
                      ? amount
                      : new BigNumber(amount.toString())
                  ).toFixed()
                : undefined,
        },
    });

    public Contract = (params: {
        to: string;
        method: string;
        values: EthArg[];
        txConfig?: PayableOverrides;
    }): EVMPayload => ({
        chain: this.chain,
        type: "contract",
        params: {
            to: params.to,
            method: params.method,
            values: [
                ...params.values,
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
            ],
            txConfig: params.txConfig,
        },
    });

    // /** @category Main */
    // public Address = (address: string): OutputContractCall => ({
    //     chain: this.chain,
    //     getPayload: async (asset: string, type: OutputType) => {
    //         switch (type) {
    //             case OutputType.Mint:
    //                 return {
    //                     to: this.network.addresses.BasicAdapter,
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
    //                     to: this.network.addresses.BasicAdapter,
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
