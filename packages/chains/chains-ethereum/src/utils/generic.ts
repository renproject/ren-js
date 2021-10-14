import BigNumber from "bignumber.js";
import {
    Contract,
    ContractReceipt,
    ContractTransaction,
    PayableOverrides,
    providers,
    Signer,
    utils,
} from "ethers";
import { Result } from "ethers/lib/utils";

import { Provider, TransactionReceipt } from "@ethersproject/providers";
import {
    ChainTransaction,
    EventEmitterTyped,
    InputChainTransaction,
    Logger,
} from "@renproject/interfaces";
import {
    assertType,
    fromHex,
    isDefined,
    isHex,
    Ox,
    SECONDS,
    sleep,
    toNBytes,
    toURLBase64,
} from "@renproject/utils";

import {
    findABIMethod,
    getEventTopic,
    getMintGatewayInstance,
    LockGatewayABI,
    MintGatewayABI,
} from "../contracts";
import { TypedEvent } from "../contracts/typechain/commons";
import { LogLockToChainEvent } from "../contracts/typechain/LockGatewayV3";
import { LogBurnEvent } from "../contracts/typechain/MintGatewayV3";
import { AbiItem } from "./abi";
import { getLockGateway, getMintGateway } from "./gatewayRegistry";
import { EvmNetworkConfig } from "./types";

export const mapBurnLogToInputChainTransaction = (
    event: LogBurnEvent,
): InputChainTransaction => {
    const [to, amount, burnNonce] = event.args;
    return {
        txid: toURLBase64(fromHex(event.transactionHash)),
        txindex: "0",
        amount: amount.toString(),
        toRecipient: to,
        nonce: toURLBase64(toNBytes(burnNonce.toString(), 32)),
    };
};

export const mapLockLogToInputChainTransaction = (
    event: LogLockToChainEvent,
): InputChainTransaction => {
    const [
        recipientAddress,
        recipientChain,
        recipientPayload,
        amount,
        lockNonce,
    ] = event.args;
    if (toNBytes(fromHex(lockNonce.toString()), 32).length !== 32) {
        throw new Error("Invalid nonce length");
    }
    return {
        txid: toURLBase64(fromHex(event.transactionHash)),
        txindex: "0",
        amount: amount.toString(),
        nonce: toURLBase64(toNBytes(lockNonce.toString(), 32)),
        toRecipient: recipientAddress,
        toChain: recipientChain,
        toPayload: toURLBase64(fromHex(recipientPayload)),
    };
};

export const extractBurnDetails = (
    receipt: providers.TransactionReceipt,
): InputChainTransaction[] => {
    const logBurnABI = findABIMethod(MintGatewayABI, "LogBurn");

    if (!receipt.blockHash) {
        throw new Error(`Transaction not confirmed yet.`);
    }

    const burnDetails = filterLogs<LogBurnEvent>(receipt.logs, logBurnABI).map(
        mapBurnLogToInputChainTransaction,
    );

    if (burnDetails.length) {
        return burnDetails;
    }

    throw Error("No burn found in logs");
};

export const findBurnByNonce = async (
    network: EvmNetworkConfig,
    provider: Provider,
    asset: string,
    nonce: Buffer,
    blockLimit?: number,
): Promise<InputChainTransaction | undefined> => {
    const gatewayAddress = await getMintGateway(network, provider, asset);
    const logBurnABI = findABIMethod(MintGatewayABI, "LogBurn");

    const burnLogs = await getPastLogs<LogBurnEvent>(
        provider,
        gatewayAddress,
        logBurnABI,
        [Ox(nonce)],
        blockLimit,
    );
    const decodedBurnLogs = burnLogs.map(mapBurnLogToInputChainTransaction);

    return decodedBurnLogs.length ? decodedBurnLogs[0] : undefined;
};

const txHashToChainTransaction = (txHash: string): ChainTransaction => ({
    txid: txHash,
    txindex: "0",
});

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

    const newMintEvents = (
        await getPastLogs<LogBurnEvent>(
            provider,
            gatewayAddress,
            logMintABI,
            [null, null, Ox(nHash)],
            blockLimit,
        )
    ).map((event) => txHashToChainTransaction(event.transactionHash));
    if (newMintEvents.length) {
        if (newMintEvents.length > 1) {
            console.warn(`Found more than one mint log.`);
        }
        return newMintEvents[0];
    }

    if (sigHash) {
        // We can skip the `status` check and call `getPastLogs` directly - for now both are called in case
        // the contract
        const status = await gatewayInstance.status(Ox(sigHash));
        if (!status) {
            return undefined;
        }
        const oldMintEvents = await getPastLogs<LogBurnEvent>(
            provider,
            gatewayAddress,
            logMintABI,
            [null, null, Ox(sigHash)],
            blockLimit,
        );
        if (oldMintEvents.length) {
            if (oldMintEvents.length > 1) {
                console.warn(`Found more than one mint log.`);
            }

            return oldMintEvents.map((event) =>
                txHashToChainTransaction(event.transactionHash),
            )[0];
        }

        return txHashToChainTransaction("");
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
            [null, null, Ox(nHash)],
            blockLimit,
        )
    ).map((event) => txHashToChainTransaction(event.transactionHash));

    if (newReleaseEvents.length > 1) {
        console.warn(`Found more than one release log.`);
    }

    return newReleaseEvents.length ? newReleaseEvents[0] : undefined;
};

export const filterLogs = <T extends TypedEvent<Result>>(
    logs: providers.Log[],
    eventABI: AbiItem,
): T[] => {
    if (!logs) {
        throw Error("No events found in transaction");
    }

    const logTopic = Ox(getEventTopic(eventABI));

    const logDecoder = new utils.Interface([eventABI]);

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
export const getPastLogs = async <T extends TypedEvent<any>>(
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
        topics: [Ox(getEventTopic(eventABI)), ...filter] as string[],
    });

    return filterLogs<T>(events, eventABI);
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

export const submitToEthereum = async (
    signer: Signer,
    to: string,
    abi: AbiItem,
    txConfig: PayableOverrides,
    params: unknown[],

    eventEmitter: EventEmitterTyped<{
        transactionHash: [string];
        confirmation: [number, { status: number }];
    }>,
): Promise<ContractReceipt> => {
    if (!abi.name) {
        throw new Error(`ABI must include method name.`);
    }

    const contract = new Contract(to, [abi], signer);

    const config: PayableOverrides = {
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
        gasLimit: 1000000,
    };

    const tx: ContractTransaction = await contract[abi.name](...params, config);

    eventEmitter.emit("transactionHash", tx.hash);
    const receipt = await tx.wait();

    eventEmitter.emit("confirmation", 1, { status: 1 });

    return receipt;
};

export const validateAddress = (address: string): boolean => {
    if (/^.+\.eth$/.exec(address)) {
        return true;
    }
    try {
        utils.getAddress(address);
        return true;
    } catch (_error) {
        return false;
    }
};

export const validateTransaction = (transaction: ChainTransaction): boolean =>
    transaction !== null &&
    isHex(transaction.txid, { length: 32, prefix: true });
