import { Provider } from "@ethersproject/providers";
import {
    ChainTransaction,
    InputChainTransaction,
    InputType,
    RenNetwork,
    utils,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { defaultAbiCoder, ParamType } from "ethers/lib/utils";

import {
    findABIMethod,
    getEventTopic,
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
import { EVMNetworkConfig, EVMNetworkInput } from "./types";

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
 * @param txid An Ethereum transaction hash formatted as bytes.
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
        txHash: utils.Ox(txHashBytes),
        txid: utils.toURLBase64(txHashBytes),
        txindex: "0",
        explorerLink,

        /** @deprecated Renamed to `txHash`. */
        txidFormatted: utils.Ox(txHashBytes),
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
        toRecipient: to,
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
        _recipientChain,
        _recipientPayload,
        amount,
        burnNonce,
    ] = event.args;
    return {
        ...txHashToChainTransaction(chain, event.transactionHash, explorerLink),
        asset,
        amount: amount.toString(),
        toRecipient: recipientAddress,
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
        nonce: utils.toURLBase64(nonceBytes),
        toRecipient: recipientAddress,
        toChain: recipientChain,
        toPayload: utils.toURLBase64(utils.fromHex(recipientPayload)),
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
            ({ txid: string } | { txHash: string } | { txidFormatted: string }),
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
                burnLogs[0],
                transactionExplorerLink({
                    txHash: burnLogs[0].transactionHash,
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
                burnToChainLogs[0],
                transactionExplorerLink({
                    txHash: burnToChainLogs[0].transactionHash,
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
                logLockLogs[0],
                transactionExplorerLink({
                    txHash: logLockLogs[0].transactionHash,
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
    sigHash?: Uint8Array,
    blockLimit?: number,
): Promise<string | undefined> => {
    const gatewayAddress = await getMintGateway(network, provider, asset);
    const gatewayInstance = getMintGatewayInstance(provider, gatewayAddress);
    const logMintABI = findABIMethod(MintGatewayABI, "LogMint");

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
        return mintEvents[0].transactionHash;
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
    blockLimit?: number,
): Promise<string | undefined> => {
    const gatewayAddress = await getLockGateway(network, provider, asset);
    const logLockABI = findABIMethod(LockGatewayABI, "LogRelease");

    const newReleaseEvents = await getPastLogs<LogBurnEvent>(
        provider,
        gatewayAddress,
        logLockABI,
        [null, null, utils.Ox(nHash)],
        blockLimit,
    );

    if (newReleaseEvents.length > 1) {
        console.warn(`Found more than one release log.`);
    }

    return newReleaseEvents.length
        ? newReleaseEvents[0].transactionHash
        : undefined;
};

export const filterLogs = <T extends TypedEvent>(
    logs: ethers.providers.Log[],
    eventABI: AbiItem,
): T[] => {
    if (!logs) {
        throw Error("No events found in transaction");
    }

    const logTopic = utils.Ox(getEventTopic(eventABI));

    const logDecoder = new ethers.utils.Interface([eventABI]);

    return logs
        .filter((event) => event.topics[0] === logTopic)
        .map(
            (event) =>
                ({
                    ...logDecoder.parseLog(event),
                    transactionHash: event.transactionHash,
                } as unknown as T),
        );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPastLogs = async <T extends TypedEvent>(
    provider: Provider,
    contractAddress: string,
    eventABI: AbiItem,
    filter: unknown[],
    blockLimit?: number,
): Promise<T[]> => {
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
        topics: [utils.Ox(getEventTopic(eventABI)), ...filter] as string[],
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
        ({ txid: string } | { txHash: string } | { txidFormatted: string }),
): boolean => {
    return (
        (utils.isDefined(transaction.txid) ||
            utils.isDefined(transaction.txHash) ||
            utils.isDefined(transaction.txidFormatted)) &&
        (transaction.txHash
            ? utils.isHex(transaction.txHash, {
                  length: 32,
                  prefix: true,
              })
            : true) &&
        (transaction.txidFormatted
            ? utils.isHex(transaction.txidFormatted, {
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
        (transaction.txidFormatted && transaction.txid
            ? utils.toURLBase64(txHashToBytes(transaction.txidFormatted)) ===
              transaction.txid
            : true) &&
        (transaction.txindex === undefined || transaction.txindex === "0")
    );
};

export const rawEncode = (
    types: Array<string | ParamType>,
    parameters: unknown[],
): Uint8Array => utils.fromHex(defaultAbiCoder.encode(types, parameters));

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
            configMap[RenNetwork.Mainnet] ||
            configMap[RenNetwork.Testnet] ||
            configMap[RenNetwork.Devnet];
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
/** @deprecated Renamed to resolveEVMNetworkConfig. */
export const resolveEvmNetworkConfig = resolveEVMNetworkConfig;
