import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";

import { Provider } from "@ethersproject/providers";
import {
    ChainTransaction,
    InputChainTransaction,
    utils,
} from "@renproject/utils";

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
import { EvmNetworkConfig } from "./types";

/**
 * Convert an Ethereum transaction hash from its standard format to the format
 * required by RenVM.
 * @param txidFormatted An Ethereum transaction hash formatted as a 0x-prefixed
 * hex string.
 * @returns The same Ethereum transaction hash formatted as a base64 string.
 */
export function txidFormattedToTxid(txidFormatted: string): string {
    return utils.toURLBase64(utils.fromHex(txidFormatted));
}

/**
 * Convert an Ethereum transaction hash from the format required by RenVM to its
 * standard format.
 * @param txid An Ethereum transaction hash formatted as a base64 string.
 * @returns The same Ethereum transaction hash formatted as a 0x-prefixed hex
 * string.
 */
export function txidToTxidFormatted(txid: string): string {
    return utils.Ox(utils.fromBase64(txid));
}

export const txHashToChainTransaction = (
    chain: string,
    txHash: string,
): ChainTransaction => {
    const txHashBuffer = utils.fromHex(txHash);
    return {
        chain,
        // Standardize.
        txidFormatted: utils.Ox(txHashBuffer),
        txid: utils.toURLBase64(txHashBuffer),
        txindex: "0",
    };
};

export const mapBurnLogToInputChainTransaction = (
    chain: string,
    asset: string,
    event: LogBurnEvent,
): InputChainTransaction => {
    const [to, amount, burnNonce] = event.args;
    return {
        ...txHashToChainTransaction(chain, event.transactionHash),
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
): InputChainTransaction => {
    const [
        recipientAddress,
        _recipientChain,
        _recipientPayload,
        amount,
        burnNonce,
    ] = event.args;
    return {
        ...txHashToChainTransaction(chain, event.transactionHash),
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
): InputChainTransaction => {
    const [
        recipientAddress,
        recipientChain,
        recipientPayload,
        amount,
        lockNonce,
    ] = event.args;
    const nonceBuffer = utils.toNBytes(new BigNumber(lockNonce.toString()), 32);
    if (nonceBuffer.length !== 32) {
        throw new Error("Invalid nonce length");
    }
    return {
        ...txHashToChainTransaction(chain, event.transactionHash),
        asset,
        amount: amount.toString(),
        nonce: utils.toURLBase64(nonceBuffer),
        toRecipient: recipientAddress,
        toChain: recipientChain,
        toPayload: utils.toURLBase64(utils.fromHex(recipientPayload)),
    };
};

export const mapTransferLogToInputChainTransaction = (
    chain: string,
    asset: string,
    event: LogTransferredEvent,
): InputChainTransaction => {
    const [_from, _to, amount] = event.args;
    return {
        ...txHashToChainTransaction(chain, event.transactionHash),
        asset,
        amount: amount.toString(),
    };
};

// export const extractBurnDetails = (
//     chain: string,
//     receipt: providers.TransactionReceipt,
// ): InputChainTransaction[] => {
//     const logBurnABI = findABIMethod(MintGatewayABI, "LogBurn");

//     if (!receipt.blockHash) {
//         throw new Error(`Transaction not confirmed yet.`);
//     }

//     const burnDetails = filterLogs<LogBurnEvent>(receipt.logs, logBurnABI).map(
//         (e) => mapBurnLogToInputChainTransaction(chain, e),
//     );

//     if (burnDetails.length) {
//         return burnDetails;
//     }

//     throw Error("No burn found in logs");
// };

// export const findBurnByNonce = async (
//     network: EvmNetworkConfig,
//     provider: Provider,
//     asset: string,
//     nonce: Buffer,
//     blockLimit?: number,
// ): Promise<InputChainTransaction | undefined> => {
//     const gatewayAddress = await getMintGateway(network, provider, asset);
//     const logBurnABI = findABIMethod(MintGatewayABI, "LogBurn");

//     const burnLogs = await getPastLogs<LogBurnEvent>(
//         provider,
//         gatewayAddress,
//         logBurnABI,
//         [Ox(nonce)],
//         blockLimit,
//     );
//     const decodedBurnLogs = burnLogs.map((e) =>
//         mapBurnLogToInputChainTransaction(network.selector, e),
//     );

//     return decodedBurnLogs.length ? decodedBurnLogs[0] : undefined;
// };

/**
 * Convert an EVM txHash to a RenVM ChainTransaction struct.
 * The txindex for Ethereum is currently set to 0, and the nonce is used instead
 * to differentiate locks/burns in the same EVM transaction.
 */

export const findMintBySigHash = async (
    network: EvmNetworkConfig,
    provider: Provider,
    asset: string,
    nHash: Buffer,
    sigHash?: Buffer,
    blockLimit?: number,
): Promise<ChainTransaction | undefined> => {
    const gatewayAddress = await getMintGateway(network, provider, asset);
    const gatewayInstance = getMintGatewayInstance(provider, gatewayAddress);
    const logMintABI = findABIMethod(MintGatewayABI, "LogMint");

    const mintEvents = (
        await getPastLogs<LogMintEvent>(
            provider,
            gatewayAddress,
            logMintABI,
            [null, null, utils.Ox(nHash)],
            blockLimit,
        )
    ).map((event) =>
        txHashToChainTransaction(network.selector, event.transactionHash),
    );
    if (mintEvents.length) {
        if (mintEvents.length > 1) {
            console.warn(`Found more than one mint log.`);
        }
        return mintEvents[0];
    }

    if (sigHash) {
        // We can skip the `status` check and call `getPastLogs` directly - for now both are called in case
        // the contract
        const status = await gatewayInstance.status(utils.Ox(sigHash));
        if (status) {
            return txHashToChainTransaction(network.selector, "");
        }
    }

    return undefined;
};

export const findReleaseBySigHash = async (
    network: EvmNetworkConfig,
    provider: Provider,
    asset: string,
    nHash: Buffer,
    blockLimit?: number,
): Promise<ChainTransaction | undefined> => {
    const gatewayAddress = await getLockGateway(network, provider, asset);
    const logLockABI = findABIMethod(LockGatewayABI, "LogRelease");

    const newReleaseEvents = (
        await getPastLogs<LogBurnEvent>(
            provider,
            gatewayAddress,
            logLockABI,
            [null, null, utils.Ox(nHash)],
            blockLimit,
        )
    ).map((event) =>
        txHashToChainTransaction(network.selector, event.transactionHash),
    );

    if (newReleaseEvents.length > 1) {
        console.warn(`Found more than one release log.`);
    }

    return newReleaseEvents.length ? newReleaseEvents[0] : undefined;
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

export const validateTransaction = (transaction: ChainTransaction): boolean =>
    transaction !== null &&
    utils.isHex(transaction.txid, { length: 32, prefix: true });

export const rawEncode = (types: string[], parameters: unknown[]): Buffer =>
    utils.fromHex(defaultAbiCoder.encode(types, parameters));
