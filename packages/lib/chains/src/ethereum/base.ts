import {
    ContractCall,
    Logger,
    MintChain,
    MintTransaction,
    provider,
    RenContract,
    RenNetwork,
    RenTokens,
} from "@renproject/interfaces";
import { RenNetworkDetails, RenNetworkDetailsMap } from "@renproject/networks";
import {
    extractError,
    ignorePromiEventError,
    Ox,
    parseRenContract,
    payloadToABI,
    payloadToMintABI,
    PromiEvent,
    SECONDS,
    sleep,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import BlocknativeSdk from "bnc-sdk";
import { EventEmitter } from "events";
import Web3 from "web3";
import { TransactionConfig, TransactionReceipt } from "web3-core";
import { AbiCoder } from "web3-eth-abi";
import { keccak256 as web3Keccak256, sha3 } from "web3-utils";

import { Callable } from "../class";

export type Web3Events = {
    transactionHash: [string];
    receipt: [TransactionReceipt];
    confirmation: [number, TransactionReceipt];
    error: [Error];
};

export type RenWeb3Events = {
    eth_transactionHash: [string];
    eth_receipt: [TransactionReceipt];
    eth_confirmation: [number, TransactionReceipt];
    error: [Error];
};

/**
 * Forward the events emitted by a Web3 PromiEvent to another PromiEvent.
 */
export const forwardWeb3Events = <T, TEvents extends Web3Events>(
    src: PromiEvent<T, TEvents>,
    dest: EventEmitter /*, filterFn = (_name: string) => true*/
) => {
    src.on("transactionHash", (eventReceipt: string) => {
        dest.emit("transactionHash", eventReceipt);
        dest.emit("eth_transactionHash", eventReceipt);
    });
    src.on("receipt", (eventReceipt: TransactionReceipt) => {
        dest.emit("receipt", eventReceipt);
        dest.emit("eth_receipt", eventReceipt);
    });
    src.on(
        "confirmation",
        (confNumber: number, eventReceipt: TransactionReceipt) => {
            dest.emit("confirmation", confNumber, eventReceipt);
            dest.emit("eth_confirmation", confNumber, eventReceipt);
        }
    );
    src.on("error", (error: Error) => {
        dest.emit("error", error);
    });
};

export const BURN_TOPIC = web3Keccak256("LogBurn(bytes,uint256,uint256,bytes)");

/**
 * Waits for the receipt of a transaction to be available, retrying every 3
 * seconds until it is.
 *
 * @param web3 A web3 instance.
 * @param transactionHash The hash of the transaction being read.
 *
 * @/param nonce The nonce of the transaction, to detect if it has been
 *        overwritten.
 */
export const waitForReceipt = async (
    web3: Web3,
    transactionHash: string /*, nonce?: number*/
) =>
    new Promise<TransactionReceipt>(async (resolve, reject) => {
        let blocknative;

        try {
            // Initialize Blocknative SDK.
            blocknative = new BlocknativeSdk({
                dappId: "6b3d07f1-b158-4cf1-99ec-919b11fe3654", // Public RenJS key.
                networkId: await web3.eth.net.getId(),
            });

            const { emitter } = blocknative.transaction(transactionHash);
            emitter.on("txSpeedUp", (state) => {
                if (state.hash) {
                    transactionHash = Ox(state.hash);
                }
            });
            emitter.on("txCancel", () => {
                reject(new Error("Ethereum transaction was cancelled."));
            });
        } catch (error) {
            // Ignore blocknative error.
        }

        // Wait for confirmation
        let receipt: TransactionReceipt | undefined;
        while (!receipt || !receipt.blockHash) {
            receipt = (await web3.eth.getTransactionReceipt(
                transactionHash
            )) as TransactionReceipt;
            if (receipt && receipt.blockHash) {
                break;
            }
            await sleep(15 * SECONDS);
        }

        try {
            // Destroy blocknative SDK.
            if (blocknative) {
                blocknative.unsubscribe(transactionHash);
                blocknative.destroy();
            }
        } catch (error) {
            // Ignore blocknative error.
        }

        // Status might be undefined - so check against `false` explicitly.
        if (receipt.status === false) {
            reject(
                new Error(
                    `Transaction was reverted. { "transactionHash": "${transactionHash}" }`
                )
            );
            return;
        }

        resolve(receipt);
        return;
    });

export const extractBurnReference = async (
    web3: Web3,
    txHash: string
): Promise<number | string> => {
    const receipt = await waitForReceipt(web3, txHash);

    if (!receipt.logs) {
        throw Error("No events found in transaction");
    }

    let burnReference: number | string | undefined;

    for (const [, event] of Object.entries(receipt.logs)) {
        if (event.topics[0] === BURN_TOPIC) {
            burnReference = event.topics[1] as string;
            break;
        }
    }

    if (!burnReference && burnReference !== 0) {
        throw Error("No reference ID found in logs");
    }

    return burnReference;
};

export const defaultAccountError = "No accounts found in Web3 wallet.";
export const withDefaultAccount = async (
    web3: Web3,
    config: TransactionConfig
): Promise<TransactionConfig> => {
    if (!config.from) {
        if (web3.eth.defaultAccount) {
            config.from = web3.eth.defaultAccount;
        } else {
            const accounts = await web3.eth.getAccounts();
            if (accounts.length === 0) {
                throw new Error(defaultAccountError);
            }
            config.from = accounts[0];
        }
    }
    return config;
};

/**
 * Bind a promiEvent to an Ethereum transaction hash, sending confirmation
 * events. Web3 may export a similar function, which should be used instead if
 * it exists.
 *
 * @param web3 A Web3 instance for watching for confirmations.
 * @param txHash The Ethereum transaction has as a hex string.
 * @param promiEvent The existing promiEvent to forward events to.
 */
export const manualPromiEvent = async (
    web3: Web3,
    txHash: string,
    promiEvent: PromiEvent<TransactionReceipt, Web3Events & RenWeb3Events>
) => {
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    promiEvent.emit("transactionHash", txHash);

    const emitConfirmation = async () => {
        const currentBlock = await web3.eth.getBlockNumber();
        promiEvent.emit(
            "confirmation",
            Math.max(0, currentBlock - receipt.blockNumber),
            // tslint:disable-next-line: no-any
            receipt as any
        );
    };

    // The following section should be revised to properly
    // register the event emitter to the transaction's
    // confirmations, so that on("confirmation") works
    // as expected. This code branch only occurs if a
    // completed transfer is passed to RenJS again, which
    // should not usually happen.

    // Emit confirmation now and in 1s, since a common use
    // case may be to have the following code, which doesn't
    // work if we emit the txHash and confirmations
    // with no time in between:
    //
    // ```js
    // const txHash = await new Promise((resolve, reject) => lockAndMint.on("transactionHash", resolve).catch(reject));
    // lockAndMint.on("confirmation", () => { /* do something */ });
    // ```
    await emitConfirmation();
    setTimeout(emitConfirmation, 1000);
    return receipt;
};

export const getTokenName = (
    tokenOrContract: RenTokens | RenContract
): RenTokens => {
    switch (tokenOrContract) {
        case "BTC":
            return "BTC";
        case "ZEC":
            return "ZEC";
        case "BCH":
            return "BCH";
        case "ETH":
            throw new Error(`Unexpected token ${tokenOrContract}`);
        default:
            return getTokenName(parseRenContract(tokenOrContract).asset);
    }
};

export const getTokenAddress = async (
    network: RenNetworkDetails,
    web3: Web3,
    tokenOrContract: RenTokens | RenContract
): Promise<string> => {
    try {
        const registry = new web3.eth.Contract(
            network.addresses.GatewayRegistry.abi,
            network.addresses.GatewayRegistry.address
        );
        return await registry.methods
            .getTokenBySymbol(getTokenName(tokenOrContract))
            .call();
    } catch (error) {
        (
            error || {}
        ).error = `Error looking up ${tokenOrContract} token address: ${error.message}`;
        throw error;
    }
};

export const getGatewayAddress = async (
    network: RenNetworkDetails,
    web3: Web3,
    tokenOrContract: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")
) => {
    try {
        const registry = new web3.eth.Contract(
            network.addresses.GatewayRegistry.abi,
            network.addresses.GatewayRegistry.address
        );
        return await registry.methods
            .getGatewayBySymbol(getTokenName(tokenOrContract))
            .call();
    } catch (error) {
        (
            error || {}
        ).error = `Error looking up ${tokenOrContract}Gateway address: ${error.message}`;
        throw error;
    }
};

export const findTransactionBySigHash = async (
    network: RenNetworkDetails,
    web3: Web3,
    tokenOrContract: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH"),
    sigHash: string
): Promise<string | undefined> => {
    try {
        const gatewayAddress = await getGatewayAddress(
            network,
            web3,
            tokenOrContract
        );
        const gatewayContract = new web3.eth.Contract(
            network.addresses.Gateway.abi,
            gatewayAddress
        );
        // We can skip the `status` check and call `getPastLogs` directly - for now both are called in case
        // the contract
        const status = await gatewayContract.methods.status(sigHash).call();
        if (status) {
            const recentRegistrationEvents = await web3.eth.getPastLogs({
                address: gatewayAddress,
                fromBlock: "1",
                toBlock: "latest",
                // topics: [sha3("LogDarknodeRegistered(address,uint256)"), "0x000000000000000000000000" +
                // address.slice(2), null, null] as any,
                topics: [
                    sha3("LogMint(address,uint256,uint256,bytes32)"),
                    null,
                    null,
                    sigHash,
                ] as string[],
            });
            if (!recentRegistrationEvents.length) {
                throw new Error(
                    `Mint has been submitted but no log was found.`
                );
            }
            const log = recentRegistrationEvents[0];
            return log.transactionHash;
        }
    } catch (error) {
        console.warn(error);
        // Continue with transaction
    }
    return;
};

export const submitToEthereum = async (
    web3: Web3,

    contractCalls: ContractCall[],
    mintTx: MintTransaction,
    eventEmitter: EventEmitter,

    // config?: { [key: string]: unknown },
    logger?: Logger
): Promise<Transaction> => {
    if (!mintTx.out || !mintTx.out.signature) {
        throw new Error(`No signature passed to mint submission.`);
    }

    let tx: PromiEvent<unknown, Web3Events> | undefined;

    for (let i = 0; i < contractCalls.length; i++) {
        const contractCall = contractCalls[i];
        const last = i === contractCalls.length - 1;

        const {
            contractParams,
            contractFn,
            sendTo,
            txConfig: txConfigParam,
        } = contractCall;

        const callParams = last
            ? [
                  ...(contractParams || []).map((value) => value.value),
                  Ox(new BigNumber(mintTx.out.amount).toString(16)), // _amount: BigNumber
                  Ox(mintTx.out.nhash),
                  Ox(mintTx.out.signature), // _sig: string
              ]
            : (contractParams || []).map((value) => value.value);

        const ABI = last
            ? payloadToMintABI(contractFn, contractParams || [])
            : payloadToABI(contractFn, contractParams || []);

        const contract = new web3.eth.Contract(ABI, sendTo);

        const txConfig = await withDefaultAccount(web3, {
            ...txConfigParam,
            ...{
                value:
                    txConfigParam && txConfigParam.value
                        ? txConfigParam.value.toString()
                        : undefined,
                gasPrice:
                    txConfigParam && txConfigParam.gasPrice
                        ? txConfigParam.gasPrice.toString()
                        : undefined,
            },

            gas: 1000000,

            // ...config,
        });

        if (logger) {
            logger.debug(
                "Calling Ethereum contract",
                contractFn,
                sendTo,
                ...callParams,
                txConfig
            );
        }

        tx = contract.methods[contractFn](...callParams).send(txConfig);

        if (last && tx) {
            forwardWeb3Events(tx, eventEmitter);
        }
    }

    if (tx === undefined) {
        throw new Error(`Must provide contract call.`);
    }

    return await new Promise<Transaction>((innerResolve, reject) =>
        // tslint:disable-next-line: no-non-null-assertion
        tx!
            .once(
                "confirmation",
                (_confirmations: number, receipt: TransactionReceipt) => {
                    innerResolve(receipt.transactionHash);
                }
            )
            .catch((error: Error) => {
                try {
                    if (ignorePromiEventError(error)) {
                        if (logger) {
                            logger.error(extractError(error));
                        }
                        return;
                    }
                } catch (_error) {
                    /* Ignore _error */
                }
                reject(error);
            })
    );
};

export type Transaction = string;
export type Asset = "eth";

export const renNetworkToEthereumNetwork = (network: RenNetwork) => {
    switch (network) {
        case RenNetwork.Mainnet:
        case RenNetwork.Chaosnet:
            return "mainnet";
        case RenNetwork.Testnet:
        case RenNetwork.Devnet:
        case RenNetwork.Localnet:
            return "kovan";
    }
    throw new Error(`Unsupported network ${network}`);
};

export class EthereumBaseChain implements MintChain<Transaction, Asset> {
    public name = "Eth";
    public renNetwork: RenNetwork | undefined;

    public readonly web3: Web3 | undefined;
    public renNetworkDetails: RenNetworkDetails | undefined;

    public readonly getTokenContractAddress = async (
        token: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")
    ) => {
        if (!this.web3 || !this.renNetworkDetails) {
            throw new Error(`Ethereum object not initialized`);
        }
        return getTokenAddress(this.renNetworkDetails, this.web3, token);
    };
    public readonly getGatewayContractAddress = async (
        token: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")
    ) => {
        if (!this.web3 || !this.renNetworkDetails) {
            throw new Error(`Ethereum object not initialized`);
        }
        return getGatewayAddress(this.renNetworkDetails, this.web3, token);
    };

    constructor(
        web3Provider: provider,
        renNetwork?: RenNetwork,
        renNetworkDetails?: RenNetworkDetails,
        thisClass?: typeof EthereumBaseChain
    ) {
        if (!(this instanceof EthereumBaseChain)) {
            return new (thisClass || EthereumBaseChain)(
                web3Provider,
                renNetwork
            );
        }

        this.web3 = new Web3(web3Provider);

        this.renNetworkDetails =
            renNetworkDetails ||
            (renNetwork ? RenNetworkDetailsMap[renNetwork] : undefined);

        if (renNetwork) {
            this.initialize(renNetwork);
        }
    }

    /**
     * See [LockChain.initialize].
     */
    initialize = (renNetwork: RenNetwork) => {
        if (!this.renNetwork) {
            this.renNetwork = renNetwork;
            this.renNetworkDetails =
                this.renNetworkDetails || RenNetworkDetailsMap[renNetwork];
        }
        return this;
    };

    // Supported assets

    /**
     * `supportsAsset` should return true if the asset is native to the
     * MintChain.
     *
     * @example
     * ethereum.supportsAsset = asset => asset === "ETH";
     */
    supportsAsset = (asset: Asset): boolean => {
        return asset === "eth";
    };

    /**
     * `assetDecimals` should return the number of decimals of the asset.
     *
     * If the asset is not supported, an error should be thrown.
     *
     * @example
     * ethereum.assetDecimals = asset => {
     *     if (asset === "ETH") { return 18; }
     *     throw new Error(`Unsupported asset ${asset}`);
     * }
     */
    assetDecimals = (asset: Asset): number => {
        if (asset === "eth") {
            return 18;
        }
        throw new Error(`Unsupported asset ${asset}`);
    };

    submitMint = async (
        asset: Asset,
        contractCalls: ContractCall[],
        mintTx: MintTransaction,
        eventEmitter: EventEmitter
    ): Promise<Transaction> => {
        if (!mintTx.out) {
            throw new Error(`No signature passed to mint submission.`);
        }

        if (!this.web3) {
            throw new Error(`Ethereum object not initialized`);
        }

        const existingTransaction = await this.findTransaction(asset, mintTx);
        if (existingTransaction) {
            throw new Error("manualPromiEvent: unimplemented");
            // return await manualPromiEvent(
            //     web3,
            //     existingTransaction,
            //     promiEvent
            // );
        }

        return await submitToEthereum(
            this.web3,
            contractCalls,
            mintTx,
            eventEmitter
        );
    };

    findTransaction = async (
        asset: Asset,
        mintTx: MintTransaction
    ): Promise<Transaction | undefined> => {
        if (!this.renNetworkDetails || !this.web3) {
            throw new Error(`Ethereum object not initialized`);
        }
        if (!mintTx.out) {
            throw new Error(
                `Transaction details should be fetched from RenVM first.`
            );
        }
        return findTransactionBySigHash(
            this.renNetworkDetails,
            this.web3,
            asset,
            mintTx.out.sighash
        );
    };

    resolveTokenGatewayContract = async (token: RenTokens): Promise<string> => {
        if (!this.renNetworkDetails || !this.web3) {
            throw new Error(`Ethereum object not initialized`);
        }
        return getTokenAddress(this.renNetworkDetails, this.web3, token);
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     *
     * @param {TransactionConfig} [txConfig] Optionally override default options
     *        like gas.
     * @returns {(PromiEvent<BurnAndRelease, { [event: string]: any }>)}
     */
    findBurnTransaction = async (
        params: {
            ethereumTxHash?: Transaction;
            contractCalls?: ContractCall[];
            burnReference?: string | number | undefined;
        },
        eventEmitter: EventEmitter,
        logger: Logger,
        // tslint:disable-next-line: no-any
        txConfig?: any
    ): Promise<string | number> => {
        const { contractCalls } = params;
        let { ethereumTxHash, burnReference } = params;

        // There are three parameter configs:
        // Situation (1): A `burnReference` is provided
        // Situation (2): Contract call details are provided
        // Situation (3): A txHash is provided

        // For (1), we don't have to do anything.
        if (!burnReference && burnReference !== 0) {
            if (!this.renNetworkDetails || !this.web3) {
                throw new Error(`Ethereum object not initialized`);
            }
            // Handle situation (2)
            // Make a call to the provided contract and Pass on the
            // transaction hash.
            if (contractCalls) {
                for (let i = 0; i < contractCalls.length; i++) {
                    const contractCall = contractCalls[i];
                    const last = i === contractCalls.length - 1;
                    const {
                        contractParams,
                        contractFn,
                        sendTo,
                        txConfig: txConfigParam,
                    } = contractCall;
                    const callParams = [
                        ...(contractParams || []).map((value) => value.value),
                    ];
                    const ABI = payloadToABI(contractFn, contractParams);
                    const contract = new this.web3.eth.Contract(ABI, sendTo);
                    const config = await withDefaultAccount(this.web3, {
                        ...txConfigParam,
                        ...{
                            value:
                                txConfigParam && txConfigParam.value
                                    ? txConfigParam.value.toString()
                                    : undefined,
                            gasPrice:
                                txConfigParam && txConfigParam.gasPrice
                                    ? txConfigParam.gasPrice.toString()
                                    : undefined,
                        },
                        ...txConfig,
                    });
                    logger.debug(
                        "Calling Ethereum contract",
                        contractFn,
                        sendTo,
                        ...callParams,
                        config
                    );
                    const tx = contract.methods[contractFn](...callParams).send(
                        config
                    );
                    if (last) {
                        forwardWeb3Events(tx, eventEmitter);
                    }
                    ethereumTxHash = await new Promise((resolve, reject) =>
                        tx
                            .on("transactionHash", resolve)
                            .catch((error: Error) => {
                                try {
                                    if (ignorePromiEventError(error)) {
                                        logger.error(extractError(error));
                                        return;
                                    }
                                } catch (_error) {
                                    /* Ignore _error */
                                }
                                reject(error);
                            })
                    );
                    logger.debug("Ethereum txHash", ethereumTxHash);
                }
            }
            if (!ethereumTxHash) {
                throw new Error(
                    "Must provide txHash or contract call details."
                );
            }
            burnReference = await extractBurnReference(
                this.web3,
                ethereumTxHash
            );
        }

        return burnReference;
    };
}

// /**
//  * createTransactions will create unsigned Ethereum transactions that can
//  * be signed at a later point in time. The last transaction should contain
//  * the burn that will be submitted to RenVM. Once signed and submitted,
//  * a new BurnAndRelease object should be initialized with the burn
//  * reference.
//  *
//  * @param {TransactionConfig} [txConfig] Optionally override default options
//  *        like gas.
//  * @returns {TransactionConfig[]}
//  */
// public createTransactions = (txConfig?: any): any[] => {
//     const contractCalls = this.params.contractCalls || [];

//     return contractCalls.map((contractCall) => {
//         const {
//             contractParams,
//             contractFn,
//             sendTo,
//             txConfig: txConfigParam,
//         } = contractCall;

//         const params = [
//             ...(contractParams || []).map((value) => value.value),
//         ];

//         const ABI = payloadToABI(contractFn, contractParams || []);
//         // tslint:disable-next-line: no-any
//         const web3: Web3 = new (Web3 as any)();
//         const contract = new web3.eth.Contract(ABI);

//         const data = contract.methods[contractFn](...params).encodeABI();

//         const rawTransaction = {
//             to: sendTo,
//             data,

//             ...txConfigParam,
//             ...{
//                 value:
//                     txConfigParam && txConfigParam.value
//                         ? txConfigParam.value.toString()
//                         : undefined,
//                 gasPrice:
//                     txConfigParam && txConfigParam.gasPrice
//                         ? txConfigParam.gasPrice.toString()
//                         : undefined,
//             },

//             ...txConfig,
//         };
//         this.logger.debug(
//             "Raw transaction created",
//             contractFn,
//             sendTo,
//             rawTransaction
//         );
//         return rawTransaction;
//     });
// };
