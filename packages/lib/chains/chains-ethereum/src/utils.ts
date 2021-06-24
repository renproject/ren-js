import {
    AbiItem,
    BurnDetails,
    ContractCall,
    LockAndMintTransaction,
    Logger,
    NullLogger,
    PromiEvent,
} from "@renproject/interfaces";
import {
    assert,
    assertType,
    extractError,
    fromHex,
    isDefined,
    Ox,
    payloadToABI,
    payloadToMintABI,
    SECONDS,
    sleep,
    keccak256,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import BN from "bn.js";
// import BlocknativeSdk from "bnc-sdk";
// import {
//     EthereumTransactionData,
//     EthereumTransactionLog,
// } from "bnc-sdk/dist/types/src/interfaces";
import { isValidAddress, isValidChecksumAddress } from "ethereumjs-util";
import { EventEmitter } from "events";
import { EthAddress, EthTransaction } from "./base";
import {
    Provider,
    TransactionReceipt,
    TransactionResponse,
    Web3Provider,
} from "@ethersproject/providers";
import { PopulatedTransaction } from "ethers";
import * as ethers from "ethers";

import { EthereumConfig } from "./networks";

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

export const ignorePromiEventError = (error: Error): boolean => {
    try {
        return !!(
            error &&
            error.message &&
            (/Invalid block number/.exec(error.message) ||
                /Timeout exceeded during the transaction confirmation process./.exec(
                    error.message,
                ))
        );
    } catch (innerError) {
        return false;
    }
};

/**
 * Forward the events emitted by a Web3 PromiEvent to another PromiEvent.
 */
export const forwardWeb3Events = <T, TEvents extends Web3Events>(
    src: PromiEvent<T, TEvents>,
    dest: EventEmitter,
): void => {
    // eslint-disable-next-line no-void
    void src.on("transactionHash", (eventReceipt: string) => {
        dest.emit("transactionHash", eventReceipt);
        dest.emit("eth_transactionHash", eventReceipt);
    });
    // eslint-disable-next-line no-void
    void src.on("receipt", (eventReceipt: TransactionReceipt) => {
        dest.emit("receipt", eventReceipt);
        dest.emit("eth_receipt", eventReceipt);
    });
    // eslint-disable-next-line no-void
    void src.on(
        "confirmation",
        (confNumber: number, eventReceipt: TransactionReceipt) => {
            dest.emit("confirmation", confNumber, eventReceipt);
            dest.emit("eth_confirmation", confNumber, eventReceipt);
        },
    );
    // Don't forward - instead these should be listened for and thrown.
    // // eslint-disable-next-line no-void
    // void src.on("error", (error: Error) => {
    //     dest.emit("error", error);
    // });
};

/**
 * eventTopics contains the Ethereum event identifiers (the first log topic) for
 * Gateway contract events.
 */
export const eventTopics = {
    /**
     * ```js
     * event LogBurn(
     *     bytes _to,
     *     uint256 _amount,
     *     uint256 indexed _n,
     *     bytes indexed _indexedTo
     *  );
     * ```
     */
    LogBurn: Ox(keccak256(Buffer.from("LogBurn(bytes,uint256,uint256,bytes)"))),
    /**
     * ```js
     * event LogMint(
     *     address indexed _to,
     *     uint256 _amount,
     *     uint256 indexed _n,
     *     bytes32 indexed _signedMessageHash
     * );
     * ```
     */
    LogMint: Ox(
        keccak256(Buffer.from("LogMint(address,uint256,uint256,bytes32)")),
    ),
};

/**
 * Waits for the receipt of a transaction to be available, retrying every 3
 * seconds until it is.
 *
 * @param web3 A web3 instance.
 * @param txHash The hash of the transaction being read.
 */
export const waitForReceipt = async (
    provider: Provider,
    txHash: string,
    logger?: Logger,
    timeout?: number,
): Promise<TransactionReceipt> =>
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    new Promise<TransactionReceipt>(async (resolve, reject) => {
        assertType<string>("string", { txHash });

        // let blocknative;

        // try {
        //     // Initialize Blocknative SDK.
        //     blocknative = new BlocknativeSdk({
        //         dappId: "6b3d07f1-b158-4cf1-99ec-919b11fe3654", // Public RenJS key.
        //         networkId: await web3.eth.net.getId(),
        //     });

        //     const { emitter } = blocknative.transaction(txHash);
        //     emitter.on("txSpeedUp", (state) => {
        //         if (
        //             (state as EthereumTransactionData | EthereumTransactionLog)
        //                 .hash
        //         ) {
        //             txHash = Ox(
        //                 (state as
        //                     | EthereumTransactionData
        //                     | EthereumTransactionLog).hash,
        //             );
        //         }
        //     });
        //     emitter.on("txCancel", () => {
        //         reject(new Error("Ethereum transaction was cancelled."));
        //     });
        // } catch (error) {
        //     // Ignore blocknative error.
        // }

        // Wait for confirmation
        let receipt: TransactionReceipt | undefined;
        while (!receipt || !receipt.blockHash) {
            if (logger) {
                logger.debug(`Fetching transaction receipt: ${txHash}`);
            }
            receipt = await provider.getTransactionReceipt(txHash);
            if (receipt && receipt.blockHash) {
                break;
            }
            await sleep(isDefined(timeout) ? timeout : 15 * SECONDS);
        }

        // try {
        //     // Destroy blocknative SDK.
        //     if (blocknative) {
        //         blocknative.unsubscribe(txHash);
        //         blocknative.destroy();
        //     }
        // } catch (error) {
        //     // Ignore blocknative error.
        // }

        // Status might be undefined - so check against `false` explicitly.
        if (receipt.status === 0) {
            reject(
                new Error(
                    `Transaction was reverted. { "transactionHash": "${txHash}" }`,
                ),
            );
            return;
        }

        resolve(receipt);
        return;
    });

export const parseBurnEvent = (event: {
    transactionHash: string;
    topics: Array<string>;
    data: string;
}): BurnDetails<EthTransaction> => {
    assert(event.topics[0] === eventTopics.LogBurn);

    const burnLogABI = {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "bytes",
                name: "_to",
                type: "bytes",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "_amount",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "uint256",
                name: "_n",
                type: "uint256",
            },
            {
                indexed: true,
                internalType: "bytes",
                name: "_indexedTo",
                type: "bytes",
            },
        ],
        name: "LogBurn",
        type: "event",
    };
    const burnLogDecoder = new ethers.utils.Interface([burnLogABI]);
    const decodedLog = burnLogDecoder.parseLog(event);

    const { _to, _amount, _n } = decodedLog.args;

    return {
        transaction: event.transactionHash,
        amount: new BigNumber(_amount.toString()),
        to: fromHex(_to).toString(),
        nonce: new BigNumber(_n.toString()),
    };
};

export const extractBurnDetails = async (
    provider: Provider,
    txHash: string,
    logger?: Logger,
    timeout?: number,
): Promise<BurnDetails<EthTransaction>> => {
    assertType<string>("string", { txHash });

    const receipt = await waitForReceipt(provider, txHash, logger, timeout);

    if (!receipt.logs) {
        throw Error("No events found in transaction");
    }

    const burnDetails = receipt.logs
        .filter((event) => event.topics[0] === eventTopics.LogBurn)
        .map((event) => parseBurnEvent(event));

    if (burnDetails.length > 1) {
        // WARNING: More than one burn found.
    }

    if (burnDetails.length) {
        return burnDetails[0];
    }

    throw Error("No reference ID found in logs");
};

export const getGatewayAddress = async (
    network: EthereumConfig,
    provider: Provider,
    asset: string,
): Promise<string> => {
    try {
        const getGatewayBySymbol: AbiItem = {
            constant: true,
            inputs: [
                {
                    internalType: "string",
                    name: "_tokenSymbol",
                    type: "string",
                },
            ],
            name: "getGatewayBySymbol",
            outputs: [
                {
                    internalType: "contract IGateway",
                    name: "",
                    type: "address",
                },
            ],
            payable: false,
            stateMutability: "view",
            type: "function",
        };
        const registry = new ethers.Contract(
            network.addresses.GatewayRegistry,
            [getGatewayBySymbol],
            provider,
        );
        // const registry = new web3.eth.Contract(
        //     [getGatewayBySymbol],
        //     network.addresses.GatewayRegistry,
        // );
        const registryAddress: string = Ox(
            await registry.getGatewayBySymbol(asset),
        );
        if (!registryAddress) {
            throw new Error(`Empty address returned.`);
        }
        return registryAddress;
    } catch (error) {
        (error || {}).message = `Error looking up ${asset} gateway address${
            error.message ? `: ${String(error.message)}` : "."
        }`;
        throw error;
    }
};

export const findBurnByNonce = async (
    network: EthereumConfig,
    provider: Provider,
    asset: string,
    nonce: Buffer | string | number,
): Promise<BurnDetails<EthTransaction>> => {
    const gatewayAddress = await getGatewayAddress(network, provider, asset);

    const nonceBuffer = Buffer.isBuffer(nonce)
        ? nonce
        : new BN(nonce).toArrayLike(Buffer, "be", 32);

    const burnEvents = await provider.getLogs({
        address: gatewayAddress,
        fromBlock: "1",
        toBlock: "latest",
        topics: [eventTopics.LogBurn, Ox(nonceBuffer)] as string[],
    });

    if (!burnEvents.length) {
        throw Error(`Burn not found for nonce ${Ox(nonceBuffer)}`);
    }
    if (burnEvents.length > 1) {
        // WARNING: More than one burn with the same nonce.
    }

    return parseBurnEvent(burnEvents[0]);
};

// export const defaultAccountError = "No accounts found in Web3 wallet.";
// export const withDefaultAccount = async (
//     web3: Web3,
//     config: PopulatedTransaction,
// ): Promise<PopulatedTransaction> => {
//     if (!config.from) {
//         if (web3.eth.defaultAccount) {
//             config.from = web3.eth.defaultAccount;
//         } else {
//             const accounts = await web3.eth.getAccounts();
//             if (accounts.length === 0) {
//                 throw new Error(defaultAccountError);
//             }
//             config.from = accounts[0];
//         }
//     }
//     return config;
// };

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
    provider: Provider,
    txHash: string,
    promiEvent: EventEmitter, // PromiEvent<TransactionReceipt, Web3Events & RenWeb3Events>
) => {
    assertType<string>("string", { txHash });

    const receipt = await provider.getTransactionReceipt(txHash);
    promiEvent.emit("transactionHash", txHash);

    const emitConfirmation = async () => {
        const currentBlock = await provider.getBlockNumber();
        promiEvent.emit(
            "confirmation",
            Math.max(0, currentBlock - receipt.blockNumber),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            receipt as any,
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
    setTimeout(() => {
        emitConfirmation().catch(console.error);
    }, 1000);
    return receipt;
};

export const getTokenAddress = async (
    network: EthereumConfig,
    provider: Provider,
    asset: string,
): Promise<string> => {
    try {
        const getTokenBySymbolABI: AbiItem = {
            constant: true,
            inputs: [
                {
                    internalType: "string",
                    name: "_tokenSymbol",
                    type: "string",
                },
            ],
            name: "getTokenBySymbol",
            outputs: [
                {
                    internalType: "contract IERC20",
                    name: "",
                    type: "address",
                },
            ],
            payable: false,
            stateMutability: "view",
            type: "function",
        };

        const registry = new ethers.Contract(
            network.addresses.GatewayRegistry,
            [getTokenBySymbolABI],
            provider,
        );
        const tokenAddress: string = Ox(await registry.getTokenBySymbol(asset));
        if (!tokenAddress) {
            throw new Error(`Empty address returned.`);
        }
        return tokenAddress;
    } catch (error) {
        (error || {}).message = `Error looking up ${asset} token address${
            error.message ? `: ${String(error.message)}` : "."
        }`;
        throw error;
    }
};

export const findTransactionBySigHash = async (
    network: EthereumConfig,
    provider: Provider,
    asset: string,
    nHash: Buffer,
    sigHash?: Buffer,
    blockLimit?: number,
): Promise<string | undefined> => {
    let status;
    try {
        const gatewayAddress = await getGatewayAddress(
            network,
            provider,
            asset,
        );
        const statusABI: AbiItem = {
            constant: true,
            inputs: [
                {
                    internalType: "bytes32",
                    name: "",
                    type: "bytes32",
                },
            ],
            name: "status",
            outputs: [
                {
                    internalType: "bool",
                    name: "",
                    type: "bool",
                },
            ],
            payable: false,
            stateMutability: "view",
            type: "function",
        };
        const gatewayContract = new ethers.Contract(
            gatewayAddress,
            [statusABI],
            provider,
        );

        let fromBlock = 1;
        let toBlock: string | number = "latest";
        if (blockLimit) {
            toBlock = new BigNumber(
                (await provider.getBlockNumber()).toString(),
            ).toNumber();
            fromBlock = toBlock - blockLimit + 1;
        }

        const newMintEvents = await provider.getLogs({
            address: gatewayAddress,
            fromBlock,
            toBlock,
            topics: [eventTopics.LogMint, null, null, Ox(nHash)] as string[],
        });
        if (newMintEvents.length) {
            return newMintEvents[0].transactionHash;
        }

        if (sigHash) {
            // We can skip the `status` check and call `getPastLogs` directly - for now both are called in case
            // the contract
            status = await gatewayContract.status(Ox(sigHash));
            if (!status) {
                return undefined;
            }
            const oldMintEvents = await provider.getLogs({
                address: gatewayAddress,
                fromBlock,
                toBlock,
                topics: [
                    eventTopics.LogMint,
                    null,
                    null,
                    Ox(sigHash),
                ] as string[],
            });
            if (oldMintEvents.length) {
                return oldMintEvents[0].transactionHash;
            }
        }
    } catch (error) {
        console.warn(error);
        // Continue with transaction
    }

    if (status) {
        // The sigHash has already been used, but no transaction was found.
        // Possible due to a restriction on the number logs that can be fetched,
        // which is the case on BSC.
        return "";
    }

    return;
};

export const submitToEthereum = async (
    signer: ethers.Signer,

    contractCalls: ContractCall[],
    mintTx: LockAndMintTransaction,
    eventEmitter: EventEmitter,

    // config?: { [key: string]: unknown },
    logger: Logger = NullLogger,
): Promise<EthTransaction> => {
    if (!mintTx.out) {
        throw new Error(`No result available from RenVM transaction.`);
    }

    if (mintTx.out.revert !== undefined) {
        throw new Error(`Unable to submit reverted RenVM transaction.`);
    }

    if (!mintTx.out.signature) {
        throw new Error(`No signature available from RenVM transaction.`);
    }

    let tx: TransactionResponse | undefined;

    for (let i = 0; i < contractCalls.length; i++) {
        const contractCall = contractCalls[i];
        const last = i === contractCalls.length - 1;

        const { contractParams, contractFn, sendTo } = contractCall;

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

        const contract = new ethers.Contract(sendTo, ABI, signer);

        const txConfig =
            typeof contractCall === "object"
                ? (contractCall.txConfig as PopulatedTransaction)
                : {};

        const config = {
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
            // ...config,
        };

        logger.debug(
            "Calling Ethereum contract",
            contractFn,
            sendTo,
            ...callParams,
            config,
        );

        tx = await contract[contractFn](...callParams, config);

        // if (last && tx !== undefined) {
        //     forwardWeb3Events(tx, eventEmitter);
        // }
    }

    if (tx === undefined) {
        throw new Error(`Must provide contract call.`);
    }

    eventEmitter.emit("txHash", tx.hash);

    const receipt: TransactionReceipt = await tx.wait();

    return receipt.transactionHash;

    // return await new Promise<EthTransaction>((innerResolve, reject) => {
    //     if (tx === undefined) {
    //         throw new Error(`Must provide contract call.`);
    //     }

    //     tx.once(
    //         "confirmation",
    //         (_confirmations: number, receipt: TransactionReceipt) => {
    //             innerResolve(receipt.transactionHash);
    //         },
    //     ).catch((error: Error) => {
    //         try {
    //             if (ignorePromiEventError(error)) {
    //                 logger.error(extractError(error));
    //                 return;
    //             }
    //         } catch (_error) {
    //             /* Ignore _error */
    //         }
    //         reject(error);
    //     });
    // });
};

export const addressIsValid = (address: EthAddress): boolean => {
    if (/^.+\.eth$/.exec(address)) {
        return true;
    }
    if (/^0x[a-f0-9]{40}$/.exec(address)) {
        return isValidAddress(address);
    }
    if (/^0x[a-fA-F0-9]{40}$/.exec(address)) {
        return isValidChecksumAddress(address);
    }
    return false;
};
