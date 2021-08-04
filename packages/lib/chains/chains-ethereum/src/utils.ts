import {
    AbiItem,
    BurnDetails,
    ContractCall,
    EventEmitterTyped,
    LockAndMintTransaction,
    Logger,
    NullLogger,
} from "@renproject/interfaces";
import {
    assert,
    assertType,
    fromHex,
    isDefined,
    isHex,
    Ox,
    payloadToABI,
    payloadToMintABI,
    SECONDS,
    sleep,
    keccak256,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import BN from "bn.js";
import { EthAddress, EthTransaction } from "./types";
import { Provider, TransactionReceipt } from "@ethersproject/providers";
import { Overrides } from "ethers";
import * as ethers from "ethers";

import { EthereumConfig } from "./networks";

export interface EthereumTransactionConfig extends Overrides {
    value?: ethers.BigNumberish | Promise<ethers.BigNumberish>;
}

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

export const parseBurnEvent = (event: {
    transactionHash: string;
    topics: string[];
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

    const [_to, _amount, _n] = decodedLog.args;

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
        ? Buffer.from(nonce)
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
        (error || {}).message = `Error looking up ${asset} token address on ${
            network.chainLabel
        }${error.message ? `: ${String(error.message)}` : "."}`;
        throw error;
    }
};

export const findMintBySigHash = async (
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
    eventEmitter: EventEmitterTyped<{
        transactionHash: [string];
        confirmation: [number, { status: number }];
    }>,

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

    let transaction: string | undefined;

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
                ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                  (contractCall.txConfig as EthereumTransactionConfig)
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

        const tx = await contract[contractFn](...callParams, config);

        if (last) {
            eventEmitter.emit("transactionHash", tx.hash);
        }
        const receipt = await tx.wait();

        if (last) {
            eventEmitter.emit("confirmation", 1, { status: 1 });
        }

        transaction = receipt.transactionHash;
        if (logger) {
            logger.debug("Transaction hash", transaction);
        }
    }

    if (transaction === undefined) {
        throw new Error(`Must provide contract call.`);
    }

    return transaction;
};

export const addressIsValid = (address: EthAddress): boolean => {
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

export const transactionIsValid = (transaction: EthTransaction): boolean =>
    transaction !== null && isHex(transaction, { length: 32, prefix: true });
