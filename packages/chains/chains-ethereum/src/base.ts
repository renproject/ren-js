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
    Logger,
    NullLogger,
    OutputType,
    Ox,
    rawEncode,
    TxSubmitter,
    TxWaiter,
} from "@renproject/utils";

import {
    findABIMethod,
    getERC20Instance,
    LockGatewayABI,
    MintGatewayABI,
} from "./contracts";
import { LogLockToChainEvent } from "./contracts/typechain/LockGatewayV3";
import { LogBurnEvent } from "./contracts/typechain/MintGatewayV3";
import { AbiItem, EthArg, payloadToABI } from "./utils/abi";
import { callContract, EVMTxSubmitter } from "./utils/evmTxSubmitter";
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
    validateAddress,
    validateTransaction,
} from "./utils/generic";
import {
    ContractCall,
    EthereumClassConfig,
    EthProvider,
    EvmNetworkConfig,
    InputContractCall,
    OutputContractCall,
} from "./utils/types";
import { EvmExplorer, StandardEvmExplorer } from "./utils/utils";

export class EthereumBaseChain
    implements ContractChain<InputContractCall, OutputContractCall>
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

    public transactionHash = (transaction: ChainTransaction): string =>
        Ox(fromBase64(transaction.txid));

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
        address = address || (await this.signer.getAddress());

        if (asset === this.network.network.nativeCurrency.symbol) {
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
        _contractCall: OutputContractCall,
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

    submitOutput = async (
        type: OutputType,
        asset: string,
        contractCall: OutputContractCall,
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
        confirmationTarget: number,
    ): Promise<TxSubmitter | TxWaiter> => {
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
            return new DefaultTxWaiter({
                chainTransaction: existingTransaction,
                chain: this as ContractChain<
                    InputContractCall,
                    OutputContractCall
                >,
                target: confirmationTarget,
            });
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

        return new EVMTxSubmitter({
            chain: this.chain,
            getTx: async (options?: {
                overrides?: any[];
                txConfig?: PayableOverrides;
            }) =>
                callContract(this.signer, to, abi, params, {
                    ...(txConfig as PayableOverrides),
                    ...(options || {}).txConfig,
                }),
            target: confirmationTarget,
        });
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    submitInput = async (
        type: InputType,
        asset: string,
        contractCall: InputContractCall,
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

                return new EVMTxSubmitter({
                    chain: this.chain,
                    getTx: async (options?: {
                        overrides?: any[];
                        txConfig?: PayableOverrides;
                    }) =>
                        await callContract(this.signer, to, abi, params, {
                            ...(txConfig as PayableOverrides),
                            ...(options || {}).txConfig,
                        }),
                    target: confirmationTarget,
                    onReceipt: (receipt) => {
                        const logBurnABI = findABIMethod(
                            MintGatewayABI,
                            "LogBurn",
                        );
                        filterLogs<LogBurnEvent>(receipt.logs, logBurnABI)
                            .map(mapBurnLogToInputChainTransaction)
                            .map(onInput);
                    },
                });
            }

            case InputType.Lock: {
                const { to, values, method, txConfig } = contractCallDetails;

                const params = values.map((x) => x.value);
                const [abi] = payloadToABI(method, values);

                return new EVMTxSubmitter({
                    chain: this.chain,
                    getTx: async (options?: {
                        overrides?: any[];
                        txConfig?: PayableOverrides;
                    }) =>
                        await callContract(this.signer, to, abi, params, {
                            ...(txConfig as PayableOverrides),
                            ...(options || {}).txConfig,
                        }),
                    target: confirmationTarget,
                    onReceipt: (receipt) => {
                        const logLockABI = findABIMethod(
                            LockGatewayABI,
                            "LogLockToChain",
                        );
                        filterLogs<LogLockToChainEvent>(
                            receipt.logs,
                            logLockABI,
                        )
                            .map(mapLockLogToInputChainTransaction)
                            .map(onInput);
                    },
                });
            }
        }
    };

    public getInputSetup = async (
        asset: string,
        type: InputType,
        contractCall: InputContractCall,
    ) => {
        const calls = contractCall.getSetupContractCalls
            ? await contractCall.getSetupContractCalls(asset, type)
            : {};

        const txSubmitted = {};
        for (const callKey of Object.keys(calls)) {
            const contractCallDetails = calls[callKey];
            const { to, values, method, txConfig } =
                await contractCallDetails.getContractCall(asset, type);
            const params = values.map((x) => x.value);

            const abi = payloadToABI(method, values)[0];

            txSubmitted[callKey] = new EVMTxSubmitter({
                chain: this.chain,
                getTx: async (options?: {
                    overrides?: any[];
                    txConfig?: PayableOverrides;
                }) =>
                    callContract(this.signer, to, abi, params, {
                        ...(txConfig as PayableOverrides),
                        ...(options || {}).txConfig,
                    }),
                target: 1,
            });
        }
        return txSubmitted;
    };

    public getOutputSetup = async (
        asset: string,
        type: OutputType,
        contractCall: OutputContractCall,
    ) => {
        const calls = contractCall.getSetupContractCalls
            ? await contractCall.getSetupContractCalls(asset, type)
            : {};
        const txSubmitted = {};
        for (const callKey of Object.keys(calls)) {
            const contractCallDetails = calls[callKey];
            const { to, values, method, txConfig } =
                await contractCallDetails.getContractCall(asset, type);
            const params = values.map((x) => x.value);

            const abi = payloadToABI(method, values)[0];

            txSubmitted[callKey] = new EVMTxSubmitter({
                chain: this.chain,
                getTx: async (options?: {
                    overrides?: any[];
                    txConfig?: PayableOverrides;
                }) =>
                    callContract(this.signer, to, abi, params, {
                        ...(txConfig as PayableOverrides),
                        ...(options || {}).txConfig,
                    }),
                target: 1,
            });
        }
        return txSubmitted;
    };

    /* ====================================================================== */

    public FromAccount = (
        amount: BigNumber | string | number,
    ): InputContractCall => ({
        chain: this.chain,
        getSetupContractCalls: async (
            asset: string,
            type: InputType,
        ): Promise<{ [key: string]: ContractCall }> => {
            if (type !== InputType.Lock) {
                return {};
            }

            const account = await this.signer.getAddress();

            const alreadyApproved = async () => {
                const gateway = await this.getLockGateway(asset);
                const token = await this.getLockAsset(asset);
                const erc20Instance = getERC20Instance(this.provider, token);
                const allowance = new BigNumber(
                    (
                        await erc20Instance.allowance(account, gateway)
                    ).toString(),
                );
                return allowance.gte(new BigNumber(amount));
            };

            if (await alreadyApproved()) {
                return {};
            }

            const contractCall = {
                chain: this.chain,
                getContractCall: async (
                    asset: string,
                ): Promise<{
                    to: string;
                    method: string;
                    values: EthArg[];
                    txConfig?: unknown;
                }> => {
                    const gateway = await this.getLockGateway(asset);
                    const token = await this.getLockAsset(asset);

                    return {
                        to: token,
                        method: "approve",
                        values: [
                            {
                                name: "to",
                                type: "address",
                                value: gateway,
                            },
                            {
                                name: "amount",
                                type: "uint256",
                                value: amount,
                            },
                        ],
                        txConfig: {},
                    };
                },
            };

            return {
                approve: contractCall,
            };
        },
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
    });

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
