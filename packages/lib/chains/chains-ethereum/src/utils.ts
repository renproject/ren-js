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
import Web3 from "web3";
import { Log, TransactionConfig, TransactionReceipt } from "web3-core";
import { keccak256 as web3Keccak256 } from "web3-utils";
import { EthAddress, EthTransaction } from "./base";

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
    LogBurn: web3Keccak256("LogBurn(bytes,uint256,uint256,bytes)"),
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
    LogMint: web3Keccak256("LogMint(address,uint256,uint256,bytes32)"),
};

/**
 * Waits for the receipt of a transaction to be available, retrying every 3
 * seconds until it is.
 *
 * @param web3 A web3 instance.
 * @param txHash The hash of the transaction being read.
 */
export const waitForReceipt = async (
    web3: Web3,
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
            receipt = await web3.eth.getTransactionReceipt(txHash);
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
        if (receipt.status === false) {
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

export const parseBurnEvent = (
    web3: Web3,
    event: Log,
): BurnDetails<EthTransaction> => {
    assert(event.topics[0] === eventTopics.LogBurn);

    const { _to, _amount, _n } = web3.eth.abi.decodeLog(
        [
            {
                indexed: false,
                name: "_to",
                type: "bytes",
            },
            {
                indexed: false,
                name: "_amount",
                type: "uint256",
            },
            {
                indexed: true,
                name: "_n",
                type: "uint256",
            },
            {
                indexed: true,
                name: "_indexedTo",
                type: "bytes",
            },
        ],
        event.data,
        event.topics.slice(1) as string[],
    );

    return {
        transaction: event.transactionHash,
        amount: new BigNumber(_amount.toString()),
        to: fromHex(_to).toString(),
        nonce: new BigNumber(_n.toString()),
    };
};

export const extractBurnDetails = async (
    web3: Web3,
    txHash: string,
    logger?: Logger,
    timeout?: number,
): Promise<BurnDetails<EthTransaction>> => {
    assertType<string>("string", { txHash });

    const receipt = await waitForReceipt(web3, txHash, logger, timeout);

    if (!receipt.logs) {
        throw Error("No events found in transaction");
    }

    const burnDetails = receipt.logs
        .filter((event) => event.topics[0] === eventTopics.LogBurn)
        .map((event) => parseBurnEvent(web3, event));

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
    web3: Web3,
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
        const registry = new web3.eth.Contract(
            [getGatewayBySymbol],
            network.addresses.GatewayRegistry,
        );
        const registryAddress: string = await registry.methods
            .getGatewayBySymbol(asset)
            .call();
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
    web3: Web3,
    asset: string,
    nonce: Buffer | string | number,
): Promise<BurnDetails<EthTransaction>> => {
    const gatewayAddress = await getGatewayAddress(network, web3, asset);

    const nonceBuffer = Buffer.isBuffer(nonce)
        ? nonce
        : new BN(nonce).toArrayLike(Buffer, "be", 32);

    const burnEvents = await web3.eth.getPastLogs({
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

    return parseBurnEvent(web3, burnEvents[0]);
};

export const defaultAccountError = "No accounts found in Web3 wallet.";
export const withDefaultAccount = async (
    web3: Web3,
    config: TransactionConfig,
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
    promiEvent: EventEmitter, // PromiEvent<TransactionReceipt, Web3Events & RenWeb3Events>
) => {
    assertType<string>("string", { txHash });

    const receipt = await web3.eth.getTransactionReceipt(txHash);
    promiEvent.emit("transactionHash", txHash);

    const emitConfirmation = async () => {
        const currentBlock = await web3.eth.getBlockNumber();
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
    web3: Web3,
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

        const registry = new web3.eth.Contract(
            [getTokenBySymbolABI],
            network.addresses.GatewayRegistry,
        );
        const tokenAddress: string = await registry.methods
            .getTokenBySymbol(asset)
            .call();
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
    web3: Web3,
    asset: string,
    nHash: Buffer,
    sigHash?: Buffer,
    blockLimit?: number,
): Promise<string | undefined> => {
    let status;
    try {
        const gatewayAddress = await getGatewayAddress(network, web3, asset);
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
        const gatewayContract = new web3.eth.Contract(
            [statusABI],
            gatewayAddress,
        );

        let fromBlock = 1;
        let toBlock: string | number = "latest";
        if (blockLimit) {
            toBlock = new BigNumber(
                (await web3.eth.getBlockNumber()).toString(),
            ).toNumber();
            fromBlock = toBlock - blockLimit + 1;
        }
        if (sigHash) {
            // We can skip the `status` check and call `getPastLogs` directly - for now both are called in case
            // the contract
            status = await gatewayContract.methods.status(Ox(sigHash)).call();
            if (!status) {
                return undefined;
            }
            const oldMintEvents = await web3.eth.getPastLogs({
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

        const newMintEvents = await web3.eth.getPastLogs({
            address: gatewayAddress,
            fromBlock,
            toBlock,
            topics: [eventTopics.LogMint, null, null, Ox(nHash)] as string[],
        });
        if (newMintEvents.length) {
            return newMintEvents[0].transactionHash;
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
    web3: Web3,

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

    let tx: PromiEvent<unknown, Web3Events> | undefined;

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

        const contract = new web3.eth.Contract(ABI, sendTo);

        const txConfig =
            typeof contractCall === "object"
                ? (contractCall.txConfig as TransactionConfig)
                : {};

        const config = await withDefaultAccount(web3, {
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
        });

        logger.debug(
            "Calling Ethereum contract",
            contractFn,
            sendTo,
            ...callParams,
            config,
        );

        tx = contract.methods[contractFn](...callParams).send(config);

        if (last && tx !== undefined) {
            forwardWeb3Events(tx, eventEmitter);
        }
    }

    return await new Promise<EthTransaction>((innerResolve, reject) => {
        if (tx === undefined) {
            throw new Error(`Must provide contract call.`);
        }

        tx.once(
            "confirmation",
            (_confirmations: number, receipt: TransactionReceipt) => {
                innerResolve(receipt.transactionHash);
            },
        ).catch((error: Error) => {
            try {
                if (ignorePromiEventError(error)) {
                    logger.error(extractError(error));
                    return;
                }
            } catch (_error) {
                /* Ignore _error */
            }
            reject(error);
        });
    });
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
