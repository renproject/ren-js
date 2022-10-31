import { JsonFragmentType, ParamType } from "@ethersproject/abi";
import { Provider } from "@ethersproject/providers";
import {
    ChainTransaction,
    InputChainTransaction,
    InputType,
    RenNetwork,
    utils,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { ethers, Wallet } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";

import {
    findABIMethod,
    getEventTopic,
    getLockGatewayInstance,
    getMintGatewayInstance,
    LockGatewayABI,
    MintGatewayABI,
} from "../contracts";
import { TypedEvent } from "../contracts/typechain/common";
import { LogLockToChainEvent } from "../contracts/typechain/LockGatewayV3";
import {
    LogBurnEvent,
    LogBurnToChainEvent,
    LogMintEvent,
} from "../contracts/typechain/MintGatewayV3";
import { LogTransferredEvent } from "../contracts/typechain/TransferWithLog";
import { AbiItem } from "./abi";
import { getLockGateway, getMintGateway } from "./gatewayRegistry";
import {
    EthProvider,
    EthSigner,
    EVMNetworkConfig,
    EVMNetworkInput,
} from "./types";

/**
 * Convert an Ethereum transaction hash from its standard format to the format
 * required by RenVM.
 *
 * @param txHash An Ethereum transaction hash formatted as a 0x-prefixed
 * hex string.
 * @returns The same Ethereum transaction hash formatted as bytes.
 */
export const txHashToBytes = (txHash: string): Uint8Array => {
    return utils.fromHex(txHash);
};

/**
 * Convert an Ethereum transaction hash from the format required by RenVM to its
 * standard format.
 *
 * @param bytes An Ethereum transaction hash formatted as bytes.
 * @returns The same Ethereum transaction hash formatted as a 0x-prefixed hex
 * string.
 */
export const txHashFromBytes = (bytes: Uint8Array): string => {
    return utils.Ox(bytes);
};

/**
 * Convert an EVM txHash to a RenVM ChainTransaction struct.
 * The txindex for Ethereum is currently set to 0, and the nonce is used instead
 * to differentiate locks/burns in the same EVM transaction.
 */
export const txHashToChainTransaction = (
    chain: string,
    txHash: string,
    explorerLink: string,
): ChainTransaction => {
    const txHashBytes = utils.fromHex(txHash);
    return {
        chain,
        txHash: txHash === "" ? txHash : utils.Ox(txHashBytes),
        txid: utils.toURLBase64(txHashBytes),
        txindex: "0",
        explorerLink,
    };
};

export const mapBurnLogToInputChainTransaction = (
    chain: string,
    asset: string,
    event: LogBurnEvent,
    explorerLink: string,
): InputChainTransaction => {
    const [to, amount, burnNonce] = event.args;
    return {
        ...txHashToChainTransaction(chain, event.transactionHash, explorerLink),
        asset,
        amount: amount.toString(),
        toRecipient: utils.toUTF8String(utils.fromHex(to)),
        nonce: utils.toURLBase64(utils.toNBytes(burnNonce.toString(), 32)),
    };
};

export const mapBurnToChainLogToInputChainTransaction = (
    chain: string,
    asset: string,
    event: LogBurnToChainEvent,
    explorerLink: string,
): InputChainTransaction => {
    const [
        recipientAddress,
        recipientChain,
        recipientPayload,
        amount,
        burnNonce,
    ] = event.args;
    return {
        ...txHashToChainTransaction(chain, event.transactionHash, explorerLink),
        asset,
        amount: amount.toString(),
        toRecipient: recipientAddress,
        toChain: recipientChain,
        toPayload: utils.toURLBase64(utils.fromHex(recipientPayload)),
        nonce: utils.toURLBase64(utils.toNBytes(burnNonce.toString(), 32)),
    };
};

export const mapLockLogToInputChainTransaction = (
    chain: string,
    asset: string,
    event: LogLockToChainEvent,
    explorerLink: string,
): InputChainTransaction => {
    const [
        recipientAddress,
        recipientChain,
        recipientPayload,
        amount,
        lockNonce,
    ] = event.args;
    const nonceBytes = utils.toNBytes(new BigNumber(lockNonce.toString()), 32);
    if (nonceBytes.length !== 32) {
        throw new Error("Invalid nonce length");
    }
    return {
        ...txHashToChainTransaction(chain, event.transactionHash, explorerLink),
        asset,
        amount: amount.toString(),
        toRecipient: recipientAddress,
        toChain: recipientChain,
        toPayload: utils.toURLBase64(utils.fromHex(recipientPayload)),
        nonce: utils.toURLBase64(nonceBytes),
    };
};

export const mapTransferLogToInputChainTransaction = (
    chain: string,
    asset: string,
    event: LogTransferredEvent,
    explorerLink: string,
): InputChainTransaction => {
    const [_from, _to, amount] = event.args;
    return {
        ...txHashToChainTransaction(chain, event.transactionHash, explorerLink),
        asset,
        amount: amount.toString(),
    };
};

/** Find an input transaction (i.e. a burn or a lock) by its nonce. */
export const findInputByNonce = async (
    chain: string,
    inputType: InputType,
    network: EVMNetworkConfig,
    provider: Provider,
    asset: string,
    nonce: Uint8Array,
    transactionExplorerLink: (
        params: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string }),
    ) => string | undefined,
    blockLimit?: number,
): Promise<InputChainTransaction | undefined> => {
    if (inputType === InputType.Burn) {
        const gatewayAddress = await getMintGateway(network, provider, asset);

        const logBurnABI = findABIMethod(MintGatewayABI, "LogBurn");
        const burnLogs = await getPastLogs<LogBurnEvent>(
            provider,
            gatewayAddress,
            logBurnABI,
            [utils.Ox(nonce)],
            blockLimit,
        );

        if (burnLogs.length) {
            return mapBurnLogToInputChainTransaction(
                chain,
                asset,
                burnLogs[0].event,
                transactionExplorerLink({
                    txHash: burnLogs[0].log.transactionHash,
                }) || "",
            );
        }

        const logBurnToChainABI = findABIMethod(
            MintGatewayABI,
            "LogBurnToChain",
        );
        const burnToChainLogs = await getPastLogs<LogBurnToChainEvent>(
            provider,
            gatewayAddress,
            logBurnToChainABI,
            [utils.Ox(nonce)],
            blockLimit,
        );

        if (burnToChainLogs.length) {
            return mapBurnToChainLogToInputChainTransaction(
                chain,
                asset,
                burnToChainLogs[0].event,
                transactionExplorerLink({
                    txHash: burnToChainLogs[0].log.transactionHash,
                }) || "",
            );
        }
    } else {
        const gatewayAddress = await getLockGateway(network, provider, asset);

        const logLockABI = findABIMethod(LockGatewayABI, "LogLockToChain");
        const logLockLogs = await getPastLogs<LogLockToChainEvent>(
            provider,
            gatewayAddress,
            logLockABI,
            [utils.Ox(nonce)],
            blockLimit,
        );

        if (logLockLogs.length) {
            return mapLockLogToInputChainTransaction(
                chain,
                asset,
                logLockLogs[0].event,
                transactionExplorerLink({
                    txHash: logLockLogs[0].log.transactionHash,
                }) || "",
            );
        }
    }

    return undefined;
};

export const findMintBySigHash = async (
    network: EVMNetworkConfig,
    provider: Provider,
    asset: string,
    nHash: Uint8Array,
    sigHash: Uint8Array | undefined,
    blockLimit?: number,
): Promise<string | undefined> => {
    const gatewayAddress = await getMintGateway(network, provider, asset);
    const gatewayInstance = getMintGatewayInstance(provider, gatewayAddress);
    const logMintABI = findABIMethod(MintGatewayABI, "LogMint");

    // Attempt to look up the mint's event log by its nHash, allowing for the
    // mint's transaction hash to be returned.
    try {
        const mintEvents = await getPastLogs<LogMintEvent>(
            provider,
            gatewayAddress,
            logMintABI,
            [null, null, utils.Ox(nHash)],
            blockLimit,
        );
        if (mintEvents.length) {
            if (mintEvents.length > 1) {
                console.warn(`Found more than one mint log.`);
            }
            return mintEvents[0].log.transactionHash;
        }
    } catch (error) {
        // If there's no sigHash, the status function call can't be called as a
        // fallback so the error is thrown.
        if (!sigHash) {
            throw error;
        } else {
            console.error(error);
        }
    }

    if (sigHash) {
        // Check the status in case the mint's event may be too old to be
        // fetched. If the status is true, the mint succeeded, but no hash
        // is available - `""` is returned instead.
        const status = await gatewayInstance.status(utils.Ox(sigHash));
        if (status) {
            return "";
        }
    }

    return undefined;
};

export const findReleaseBySigHash = async (
    network: EVMNetworkConfig,
    provider: Provider,
    asset: string,
    nHash: Uint8Array,
    sigHash: Uint8Array | undefined,
    blockLimit?: number,
): Promise<string | undefined> => {
    const gatewayAddress = await getLockGateway(network, provider, asset);
    const gatewayInstance = getLockGatewayInstance(provider, gatewayAddress);
    const logLockABI = findABIMethod(LockGatewayABI, "LogRelease");

    // Attempt to look up the releases's event log by its nHash, allowing for
    // the releases's transaction hash to be returned.
    try {
        const newReleaseEvents = await getPastLogs<LogBurnEvent>(
            provider,
            gatewayAddress,
            logLockABI,
            [null, null, utils.Ox(nHash)],
            blockLimit,
        );

        if (newReleaseEvents.length) {
            if (newReleaseEvents.length > 1) {
                console.warn(`Found more than one release log.`);
            }
            return newReleaseEvents[0].log.transactionHash;
        }
    } catch (error) {
        // If there's no sigHash, the status function call can't be called as a
        // fallback so the error is thrown.
        if (!sigHash) {
            throw error;
        } else {
            console.error(error);
        }
    }

    if (sigHash) {
        // Check the status in case the mint's event may be too old to be
        // fetched. If the status is true, the mint succeeded, but no hash
        // is available - `""` is returned instead.
        const status = await gatewayInstance.status(utils.Ox(sigHash));
        if (status) {
            return "";
        }
    }

    return undefined;
};

export const filterLogs = <T extends TypedEvent>(
    logs: ethers.providers.Log[],
    eventABI: AbiItem,
): Array<{ event: T; log: ethers.providers.Log }> => {
    if (!logs) {
        throw Error("No events found in transaction");
    }

    const logTopic = utils.Ox(getEventTopic(eventABI));

    const logDecoder = new ethers.utils.Interface([eventABI]);

    return logs
        .filter((log) => log.topics[0] === logTopic)
        .map((log) => ({
            event: {
                ...logDecoder.parseLog(log),
                // address: event.address,
                transactionHash: log.transactionHash,
            } as unknown as T,
            log,
        }));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPastLogs = async <T extends TypedEvent>(
    provider: Provider,
    contractAddress: string,
    eventABI: AbiItem,
    filter: Array<string | null>,
    blockLimit?: number,
): Promise<Array<{ event: T; log: ethers.providers.Log }>> => {
    let fromBlock = 1;
    let toBlock: string | number = "latest";
    if (blockLimit) {
        toBlock = new BigNumber(
            (await provider.getBlockNumber()).toString(),
        ).toNumber();
        fromBlock = toBlock - blockLimit + 1;
    }

    const events = await provider.getLogs({
        address: contractAddress,
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: [utils.Ox(getEventTopic(eventABI)), ...filter],
    });

    return filterLogs<T>(events, eventABI);
};

// /**
//  * Waits for the receipt of a transaction to be available, retrying every 15
//  * seconds until it is.
//  *
//  * @param web3 A web3 instance.
//  * @param txHash The hash of the transaction being read.
//  */
// export const waitForReceipt = async (
//     provider: Provider,
//     txHash: string,
//     logger?: Logger,
//     timeout?: number,
// ): Promise<TransactionReceipt> =>
//     // eslint-disable-next-line @typescript-eslint/no-misused-promises
//     new Promise<TransactionReceipt>(async (resolve, reject) => {
//         assertType<string>("string", { txHash });

//         // Wait for confirmation
//         let receipt: TransactionReceipt | undefined;
//         while (!receipt || !receipt.blockHash) {
//             if (logger) {
//                 logger.debug(`Fetching transaction receipt: ${txHash}`);
//             }
//             receipt = await provider.getTransactionReceipt(txHash);
//             if (receipt && receipt.blockHash) {
//                 break;
//             }
//             await sleep(isDefined(timeout) ? timeout : 15 * SECONDS);
//         }

//         // Status might be undefined - so check against `false` explicitly.
//         if (receipt.status === 0) {
//             reject(
//                 new Error(
//                     `Transaction was reverted. { "transactionHash": "${txHash}" }`,
//                 ),
//             );
//             return;
//         }

//         resolve(receipt);
//         return;
//     });

// export const submitToEthereum = async (
//     chain: string,
//     signer: Signer,
//     to: string,
//     abi: AbiItem,
//     txConfig: PayableOverrides,
//     params: unknown[],

//     eventEmitter: EventEmitterTyped<{
//         transaction: [ChainTransaction];
//         confirmation: [number, { status: number }];
//     }>,
// ): Promise<ContractReceipt> => {
//     if (!abi.name) {
//         throw new Error(`ABI must include method name.`);
//     }

//     const contract = new Contract(to, [abi], signer);

//     const config: PayableOverrides = {
//         ...txConfig,
//         ...{
//             value:
//                 txConfig && txConfig.value
//                     ? txConfig.value.toString()
//                     : undefined,
//             gasPrice:
//                 txConfig && txConfig.gasPrice
//                     ? txConfig.gasPrice.toString()
//                     : undefined,
//         },
//     };

//     const tx: ContractTransaction = await contract[abi.name](...params, config);

//     eventEmitter.emit("transaction", txHashToChainTransaction(chain, tx.hash));
//     const receipt = await tx.wait();

//     eventEmitter.emit("confirmation", 1, { status: 1 });

//     return receipt;
// };

export const validateAddress = (address: string): boolean => {
    if (/^.+\.eth$/.exec(address)) {
        return true;
    }
    try {
        ethers.utils.getAddress(address);
        return true;
    } catch (_error) {
        return false;
    }
};

export const validateTransaction = (
    transaction: Partial<ChainTransaction> &
        ({ txid: string } | { txHash: string }),
): boolean => {
    return (
        (utils.isDefined(transaction.txid) ||
            utils.isDefined(transaction.txHash)) &&
        (transaction.txHash
            ? utils.isHex(transaction.txHash, {
                  length: 32,
                  prefix: true,
              })
            : true) &&
        (transaction.txid
            ? utils.isURLBase64(transaction.txid, {
                  length: 32,
              })
            : true) &&
        (transaction.txindex
            ? !new BigNumber(transaction.txindex).isNaN()
            : true) &&
        (transaction.txHash && transaction.txid
            ? utils.toURLBase64(txHashToBytes(transaction.txHash)) ===
              transaction.txid
            : true) &&
        (transaction.txindex === undefined || transaction.txindex === "0")
    );
};

const tupleRegEx = /^tuple\((.*)\)$/;
export const rawEncode = (
    types: Array<string | JsonFragmentType>,
    parameters: unknown[],
): Uint8Array => {
    return utils.fromHex(
        defaultAbiCoder.encode(
            types.map((type) => {
                // If a tuple has no components, set them.
                if (typeof type === "object" && !type.components) {
                    const match = tupleRegEx.exec(type.type || "");
                    if (match) {
                        type = {
                            ...type,
                            components: match[1].split(",").map((value) => ({
                                type: value,
                            })),
                        };
                    }
                }
                return ParamType.from(type);
            }),
            parameters,
        ),
    );
};

export const isEVMNetworkConfig = (
    renNetwork: EVMNetworkInput,
): renNetwork is EVMNetworkConfig =>
    !!(renNetwork as EVMNetworkConfig).addresses;

export const resolveEVMNetworkConfig = (
    configMap: {
        [network in RenNetwork]?: EVMNetworkConfig;
    },
    renNetwork: EVMNetworkInput,
): EVMNetworkConfig => {
    if (!renNetwork) {
        const defaultNetwork =
            configMap[RenNetwork.Mainnet] || configMap[RenNetwork.Testnet];
        if (!defaultNetwork) {
            throw new Error(`Must provide network.`);
        }
        return defaultNetwork;
    }

    let networkConfig: EVMNetworkConfig | undefined;
    if (renNetwork && isEVMNetworkConfig(renNetwork)) {
        networkConfig = renNetwork;
    } else {
        networkConfig = configMap[renNetwork];
    }

    if (!networkConfig) {
        throw new Error(
            `Unsupported network '${String(
                renNetwork
                    ? typeof renNetwork === "string"
                        ? renNetwork
                        : renNetwork.selector
                    : renNetwork,
            )}'. Valid options are 'mainnet', 'testnet' or an EVMNetworkConfig object.`,
        );
    }

    return networkConfig;
};

/**
 * Resolve an EVM chain's JSON-RPC endpoints, replacing variable keys such as
 * `${INFURA_API_KEY}` with the value provided in `variables`. If a URL has a
 * variable key that isn't provided, it is removed from the final list.
 * If a variable's value is undefined, it is not replaced.
 *
 * @param urls An array of JSON-RPC urls.
 * @param variables An object mapping variable keys to their values.
 * @param protocol A RegExp matching the required url protocol. Defaults to "https"
 * @returns An array of JSON-RPC urls with variables resolved to their values.
 *
 * @example
 * resolveRpcEndpoints(
 *  ["https://test.com/${TEST}", "https://test2.com/${MISSING}", "wss://test3.com"],
 *  { TEST: "test"},
 * )
 * > ["https://test.com/test"]
 */
export const resolveRpcEndpoints = (
    urls: string[],
    variables?: {
        INFURA_API_KEY?: string;
        ALCHEMY_API_KEY?: string;
    } & { [variableKey: string]: string | undefined },
    protocol: RegExp | string = "https",
): string[] =>
    [
        ...urls.filter((url) => url.includes("${")),
        ...urls.filter((url) => !url.includes("${")),
    ]
        // Replace variable keys surround by "${...}" with variable values.
        // If a variable's value is undefined, it is not replaced.
        .map((url) =>
            Object.keys(variables || {}).reduce(
                (urlAcc, variableKey) =>
                    urlAcc.replace(
                        `\${${variableKey}}`,
                        (variables || {})[variableKey]
                            ? String((variables || {})[variableKey])
                            : `\${${variableKey}}`,
                    ),
                url,
            ),
        )
        // Match only endpoints that don't include any left-over "${"s,
        // and that have the right protocol.
        .filter(
            (url) =>
                url.match(/^[^(${)]*$/) &&
                url.match(
                    typeof protocol === "string" ? "^" + protocol : protocol,
                ),
        );

/**
 *
 * @param provider An ethers.js provider.
 * @param network The config of the EVM network that the signer should be
 * connected to.
 * @returns The result of the comparison, including details of the expected and
 * actual networks. If `result` is true, then the signer's network is correct.
 */
export const checkProviderNetwork = async (
    provider: Provider,
    network: EVMNetworkConfig,
): Promise<{
    result: boolean;
    actualNetworkId: number;

    expectedNetworkId: number;
    expectedNetworkLabel: string;
}> => {
    const expectedNetworkId = new BigNumber(network.config.chainId).toNumber();

    const actualNetworkId = provider
        ? (await provider.getNetwork()).chainId
        : expectedNetworkId;

    return {
        result: actualNetworkId === expectedNetworkId,
        actualNetworkId,
        expectedNetworkId,
        expectedNetworkLabel: network.config.chainName,
    };
};

/**
 * Build a provider and signer for an EVM class, using the provided key and
 * PRC url variables.
 */
export const getEVMProvider = (
    networkConfig: EVMNetworkConfig,
    key:
        | { privateKey: string | Uint8Array }
        | {
              mnemonic: string;
              index?: number;
              privateKey?: undefined;
          },
    variables?: {
        INFURA_API_KEY?: string;
        ALCHEMY_API_KEY?: string;
    } & { [variableKey: string]: string | undefined },
): {
    provider: EthProvider;
    signer: EthSigner;
} => {
    const urls = resolveRpcEndpoints(networkConfig.config.rpcUrls, variables);
    const provider = new ethers.providers.JsonRpcProvider(urls[0]);

    const signer =
        key.privateKey !== undefined
            ? new Wallet(key.privateKey)
            : Wallet.fromMnemonic(
                  key.mnemonic,
                  `m/44'/60'/0'/0/${String(key.index || 0)}`,
              ).connect(provider);

    return {
        provider,
        signer,
    };
};
