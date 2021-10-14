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
    EventEmitterTyped,
    InputChainTransaction,
    InputType,
    Logger,
    NullLogger,
    OutputType,
} from "@renproject/interfaces";
import { fromBase64, Ox, rawEncode } from "@renproject/utils";

import { findABIMethod, LockGatewayABI, MintGatewayABI } from "./contracts";
import { LogLockToChainEvent } from "./contracts/typechain/LockGatewayV3";
import { LogBurnEvent } from "./contracts/typechain/MintGatewayV3";
import { AbiItem, EthArg, payloadToABI } from "./utils/abi";
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
    submitToEthereum,
    validateAddress,
    validateTransaction,
} from "./utils/generic";
import {
    ContractCall,
    EthProvider,
    EvmNetworkConfig,
    InputContractCall,
    OutputContractCall,
} from "./utils/types";
import { EvmExplorer, StandardEvmExplorer } from "./utils/utils";

export interface EthereumClassConfig {
    logger?: Logger;
}

export class EthereumBaseChain
    implements
        ContractChain<InputContractCall, OutputContractCall, ContractCall>
{
    // DepositChain<ContractCall, ContractCall>
    public static chain = "Ethereum";
    public chain: string;

    public provider: Web3Provider;
    public signer: Signer;
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
        this.logger = config.logger || NullLogger;

        // Ignore not configured error.
        this.provider = undefined as never;
        this.signer = undefined as never;
        this.withProvider(web3Provider);
    }

    public validateAddress = validateAddress;
    public validateTransaction = validateTransaction;
    public addressExplorerLink = (address: string): string =>
        this.explorer.address(address);

    public transactionHash = (transaction: ChainTransaction): string => {
        return Ox(fromBase64(transaction.txid));
    };

    public transactionExplorerLink = (transaction: ChainTransaction): string =>
        this.explorer.transaction(this.transactionHash(transaction));

    public withProvider = (web3Provider: EthProvider) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((web3Provider as any).signer && (web3Provider as any).provider) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.provider = (web3Provider as any).provider;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.signer = (web3Provider as any).signer;
            this.signer.connect(this.provider);
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
        contractCall: OutputContractCall,
    ): Promise<{
        to: string;
        payload: Buffer;
    }> => {
        const contractCallDetails = await contractCall.getPayload(asset, type);

        const zip = contractCallDetails.values;

        const args = zip.filter((arg) => !arg.notInPayload);

        const types = args.map((param) => param.type);
        const values = args.map((param): unknown => param.value);

        const payload = rawEncode(types, values);

        return {
            to: contractCallDetails.to,
            payload,
        };
    };

    // Supported assets

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

        // TODO:
        const tokenAddress = await this.getMintGateway(asset);

        const tokenContract = new Contract(
            tokenAddress,
            [balanceOfABI],
            this.provider,
        );

        const balanceRaw = await await tokenContract.balanceOf(address);

        return new BigNumber(balanceRaw.toString());
    };

    submitSetup = async (
        precheck: boolean,
        type: InputType | OutputType,
        asset: string,
        contractCall: ContractCall,
        // TODO
        _override: { [name: string]: unknown },
        _renParams: {},
        eventEmitter: EventEmitterTyped<{
            transaction: [ChainTransaction];
            confirmation: [number, { status: number }];
        }>,
    ): Promise<ChainTransaction | undefined> => {
        if (precheck) {
            return undefined;
        }

        const contractCallDetails = await contractCall.getContractCall(
            asset,
            type,
        );
        const { to, values, method, txConfig } = contractCallDetails;

        const params = values.map((x) => x.value);

        const abi = payloadToABI(method, values)[0];

        const receipt = await submitToEthereum(
            this.signer,
            to,
            abi,
            txConfig as PayableOverrides,
            params,
            eventEmitter,
        );

        return {
            txid: receipt.transactionHash,
            txindex: "0",
        };
    };

    submitOutput = async (
        precheck: boolean,
        type: OutputType,
        asset: string,
        contractCall: OutputContractCall,
        // TODO
        _override: { [name: string]: unknown },
        renParams: {
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
        eventEmitter: EventEmitterTyped<{
            transaction: [ChainTransaction];
            confirmation: [number, { status: number }];
        }>,
    ): Promise<ChainTransaction | undefined> => {
        const { pHash, amount, nHash, sigHash } = renParams;

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
            eventEmitter.emit("transaction", existingTransaction);
            eventEmitter.emit("confirmation", 1, { status: 1 });
            return existingTransaction;
        }

        if (precheck) {
            return undefined;
        }

        const rsv = renParams.signature;

        if (!rsv) {
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

        const { r, s, v } = rsv;
        const sig = Buffer.concat([r, s, Buffer.from([v])]);
        const contractCallDetails = await contractCall.getContractCall(
            asset,
            type,
            pHash,
            amount.toString(),
            nHash,
            sig,
        );
        const { to, values, method, txConfig } = contractCallDetails;

        const params = values.map((x) => x.value);

        const abi = payloadToABI(method, values)[0];

        const receipt = await submitToEthereum(
            this.signer,
            to,
            abi,
            {
                ...(txConfig as PayableOverrides),
                gasLimit: 2000000,
            },
            params,
            eventEmitter,
        );

        return {
            txid: receipt.transactionHash,
            txindex: "0",
        };
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    submitInput = async (
        precheck: boolean,
        type: InputType,
        asset: string,
        contractCall: InputContractCall,
        _override: { [name: string]: unknown },
        {
            toChain,
            toPayload,
        }: {
            toChain: string;
            toPayload: {
                to: string;
                payload: Buffer;
            };
        },
        eventEmitter: EventEmitterTyped<{
            transaction: [ChainTransaction];
            confirmation: [number, { status: number }];
        }>,
    ): Promise<InputChainTransaction[] | undefined> => {
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

        if (precheck) {
            return undefined;
        }

        // Make a call to the provided contract and Pass on the
        // transaction hash.
        const contractCallDetails = await contractCall.getContractCall(
            asset,
            type,
            toChain,
            toPayload,
        );

        switch (type) {
            case InputType.Burn: {
                const { to, values, method, txConfig } = contractCallDetails;

                const params = values.map((x) => x.value);
                const [abi] = payloadToABI(method, values);

                const receipt = await submitToEthereum(
                    this.signer,
                    to,
                    abi,
                    {
                        ...(txConfig as PayableOverrides),
                        gasLimit: 500000,
                    },
                    params,
                    eventEmitter,
                );

                const logBurnABI = findABIMethod(MintGatewayABI, "LogBurn");
                const burnDetails = filterLogs<LogBurnEvent>(
                    receipt.logs,
                    logBurnABI,
                ).map(mapBurnLogToInputChainTransaction);

                if (burnDetails.length) {
                    return burnDetails;
                }

                throw Error("No burn found in logs");
            }

            case InputType.Lock: {
                const { to, values, method, txConfig } = contractCallDetails;

                const params = values.map((x) => x.value);
                const [abi] = payloadToABI(method, values);

                await submitToEthereum(
                    this.signer,
                    "0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa",
                    {
                        inputs: [
                            {
                                internalType: "address",
                                name: "spender",
                                type: "address",
                            },
                            {
                                internalType: "uint256",
                                name: "amount",
                                type: "uint256",
                            },
                        ],
                        name: "approve",
                        outputs: [
                            {
                                internalType: "bool",
                                name: "",
                                type: "bool",
                            },
                        ],
                        stateMutability: "nonpayable",
                        type: "function",
                    } as AbiItem,
                    {
                        ...(txConfig as PayableOverrides),
                    },
                    [to, "1000000000000000000"],
                    eventEmitter,
                );

                // const txHash =
                // "0x9c272d76e8067833c391af3e0cb5f3e23699db508216816c6a8288fdfbe243a1";
                // const receipt = await this.provider.getTransactionReceipt(txHash);
                const receipt = await submitToEthereum(
                    this.signer,
                    to,
                    abi,
                    {
                        ...(txConfig as PayableOverrides),
                    },
                    params,
                    eventEmitter,
                );

                const logLockABI = findABIMethod(
                    LockGatewayABI,
                    "LogLockToChain",
                );
                const lockDetails = filterLogs<LogLockToChainEvent>(
                    receipt.logs,
                    logLockABI,
                ).map(mapLockLogToInputChainTransaction);

                if (lockDetails.length) {
                    return lockDetails;
                }

                throw Error("No lock found in logs");
            }
        }
    };

    public getInputSetup = (
        asset: string,
        type: InputType,
        contractCall: InputContractCall,
    ) => {
        return contractCall.getSetupContractCalls
            ? contractCall.getSetupContractCalls(asset, type)
            : {};
    };

    public getOutputSetup = (
        asset: string,
        type: OutputType,
        contractCall: OutputContractCall,
    ) => {
        return contractCall.getSetupContractCalls
            ? contractCall.getSetupContractCalls(asset, type)
            : {};
    };

    /* ====================================================================== */

    public FromAccount = (
        amount: BigNumber | string | number,
    ): InputContractCall => {
        return {
            chain: this.chain,
            getContractCall: async (
                asset: string,
                type: InputType,
                toChain: string,
                toPayload: {
                    to: string;
                    payload: Buffer;
                },
            ) => {
                switch (type) {
                    case InputType.Lock:
                        return {
                            to: this.network.addresses.BasicAdapter,
                            method: "lock",
                            values: [
                                {
                                    type: "string",
                                    name: "symbol_",
                                    value: asset,
                                },
                                {
                                    type: "string",
                                    name: "recipientAddress_",
                                    value: toPayload.to,
                                },
                                {
                                    type: "string",
                                    name: "recipientChain_",
                                    value: toChain,
                                },
                                {
                                    type: "bytes",
                                    name: "recipientPayload_",
                                    value: toPayload.payload,
                                },
                                {
                                    type: "uint256",
                                    name: "amount_",
                                    value: amount.toString(),
                                },
                            ],
                        };
                    case InputType.Burn:
                        const addressToBuffer = Buffer.from(toPayload.to);
                        const gateway = await this.getMintGateway(asset);

                        return {
                            to: gateway,
                            method: "burn",
                            values: [
                                {
                                    type: "bytes" as const,
                                    name: "_to",
                                    value: Ox(addressToBuffer),
                                },
                                {
                                    type: "uint256" as const,
                                    name: "_amount",
                                    value: new BigNumber(amount).toFixed(),
                                },
                            ],
                        };
                }
            },
        };
    };

    public ContractWithSignature = (
        getCall: (
            asset: string,
            type: OutputType,
        ) => {
            to: string;
            method: string;
            values: EthArg[];
        },
    ): OutputContractCall => ({
        chain: this.chain,
        getPayload: (asset: string, type: OutputType) => getCall(asset, type),
        getContractCall: (
            asset: string,
            type: OutputType,
            _pHash: Buffer,
            amount: string,
            nHash: Buffer,
            signature: Buffer,
        ) => {
            const params = getCall(asset, type);
            return {
                to: params.to,
                method: params.method,
                values: [
                    ...params.values,
                    {
                        name: "amount",
                        type: "uint256",
                        value: amount,
                    },
                    {
                        name: "nHash",
                        type: "bytes32",
                        value: nHash,
                    },
                    {
                        name: "signature",
                        type: "bytes",
                        value: signature,
                    },
                ],
            };
        },
    });

    /** @category Main */
    public Address = (address: string): OutputContractCall => ({
        chain: this.chain,
        getPayload: async (asset: string, type: OutputType) => {
            switch (type) {
                case OutputType.Mint:
                    return {
                        to: this.network.addresses.BasicAdapter,
                        method: "mint",
                        values: [
                            {
                                type: "string",
                                name: "_symbol",
                                value: asset,
                            },
                            {
                                type: "address",
                                name: "recipient_",
                                value: address,
                            },
                        ],
                    };
                case OutputType.Release:
                    return {
                        to: await this.signer.getAddress(),
                        method: "release",
                        values: [],
                    };
            }
        },
        getContractCall: async (
            asset: string,
            type: OutputType,
            pHash: Buffer,
            amount: string,
            nHash: Buffer,
            signature: Buffer,
        ) => {
            switch (type) {
                case OutputType.Mint:
                    return {
                        to: this.network.addresses.BasicAdapter,
                        method: "mint",
                        values: [
                            {
                                type: "string",
                                name: "_symbol",
                                value: asset,
                            },
                            {
                                type: "address",
                                name: "recipient_",
                                value: address,
                            },
                            {
                                name: "amount",
                                type: "uint256",
                                value: amount,
                            },
                            {
                                name: "nHash",
                                type: "bytes32",
                                value: nHash,
                            },
                            {
                                name: "signature",
                                type: "bytes",
                                value: signature,
                            },
                        ],
                    };
                case OutputType.Release:
                    return {
                        to: await this.getLockGateway(asset),
                        method: "release",
                        values: [
                            {
                                name: "pHash",
                                type: "bytes32",
                                value: pHash,
                            },
                            {
                                name: "amount",
                                type: "uint256",
                                value: amount,
                            },
                            {
                                name: "nHash",
                                type: "bytes32",
                                value: nHash,
                            },
                            {
                                name: "signature",
                                type: "bytes",
                                value: signature,
                            },
                        ],
                    };
            }
        },
    });
}
