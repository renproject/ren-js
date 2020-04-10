import {
    Chain, LockAndMintParams, NetworkDetails, TxStatus, UnmarshalledMintTx, UTXOIndex,
    UTXOWithChain,
} from "@renproject/interfaces";
import { ResponseQueryMintTx } from "@renproject/rpc";
import {
    DEFAULT_SHIFT_FEE, extractError, fixSignature, forwardWeb3Events, generateAddress,
    generateGHash, generateShiftInTxHash, getGatewayAddress, ignorePromiEventError, newPromiEvent,
    Ox, parseRenContract, payloadToABI, payloadToShiftInABI, processLockAndMintParams, PromiEvent,
    randomNonce, renTxHashToBase64, RenWeb3Events, resolveInToken, retrieveConfirmations,
    retrieveDeposits, SECONDS, signatureToString, sleep, strip0x, toBase64, toBigNumber, Web3Events,
    withDefaultAccount,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import BN from "bn.js";
import { OrderedMap } from "immutable";
import Web3 from "web3";
import { TransactionConfig, TransactionReceipt } from "web3-core";
import { provider } from "web3-providers";
import { sha3 } from "web3-utils";

import { RenVMNetwork, unmarshalMintTx } from "./renVMNetwork";

export class LockAndMint {
    public utxo: UTXOIndex | undefined;
    public gatewayAddress: string | undefined;
    public signature: string | undefined;
    private readonly network: NetworkDetails;
    private readonly renVMNetwork: RenVMNetwork;
    private readonly params: LockAndMintParams;
    private renVMResponse: UnmarshalledMintTx | undefined;

    public thirdPartyTransaction: string | undefined;

    constructor(_renVMNetwork: RenVMNetwork, _network: NetworkDetails, _params: LockAndMintParams) {
        this.network = _network;
        this.renVMNetwork = _renVMNetwork;
        this.params = processLockAndMintParams(this.network, _params);
        // this.web3 = this.params.web3Provider ? new Web3(this.params.web3Provider) : undefined;

        const renTxHash = this.params.renTxHash;

        if (!renTxHash) {
            const { sendToken: renContract, contractCalls, nonce: maybeNonce } = this.params;

            if (!contractCalls || !contractCalls.length) {
                throw new Error(`Must provide Ren transaction hash or contract call details.`);
            }

            if (!renContract) {
                throw new Error(`Must provide Ren transaction hash or token to be transferred.`);
            }

            // Last contract call
            const { contractParams, sendTo } = contractCalls[contractCalls.length - 1];

            const nonce = maybeNonce || randomNonce();
            this.params.nonce = nonce;

            // TODO: Validate inputs
            const gHash = generateGHash(contractParams || [], strip0x(sendTo), resolveInToken(renContract), nonce, this.network);
            const gatewayAddress = generateAddress(resolveInToken(renContract), gHash, this.network);
            this.gatewayAddress = gatewayAddress;
        }
    }

    public addr = () => this.gatewayAddress;

    public wait = (confirmations: number, specifyUTXO?: UTXOIndex): PromiEvent<this, { "deposit": [UTXOWithChain] }> => {
        const promiEvent = newPromiEvent<this, { "deposit": [UTXOWithChain] }>();

        (async () => {
            // If the deposit has already been submitted, "wait" can be skipped.
            if (this.params.renTxHash) {
                return this;
            }

            if (specifyUTXO) {
                let previousUtxoConfirmations = -1;
                // tslint:disable-next-line: no-constant-condition
                while (true) {
                    const utxoConfirmations = await retrieveConfirmations(this.network, {
                        chain: parseRenContract(resolveInToken(this.params.sendToken)).from,
                        hash: specifyUTXO.txHash
                    });
                    if (utxoConfirmations > previousUtxoConfirmations) {
                        previousUtxoConfirmations = utxoConfirmations;
                        promiEvent.emit("deposit", {
                            chain: parseRenContract(resolveInToken(this.params.sendToken)).from as Chain.Bitcoin | Chain.BitcoinCash | Chain.Zcash,
                            utxo: {
                                txHash: specifyUTXO.txHash,
                                amount: 0, // TODO: Get value
                                vOut: specifyUTXO.vOut,
                                confirmations: utxoConfirmations,
                            }
                        });
                    }
                    if (utxoConfirmations >= confirmations) {
                        break;
                    }
                    await sleep(10);
                }
                this.utxo = specifyUTXO;
                return this;
            }

            if (!this.gatewayAddress) {
                throw new Error("Unable to calculate gateway address.");
            }

            const { sendToken: renContract } = this.params;

            if (!renContract) {
                throw new Error(`Must provide token to be transferred.`);
            }

            // try {
            //     // Check if the darknodes have already seen the transaction
            //     const queryTxResponse = await this.queryTx();
            //     if (
            //         queryTxResponse.txStatus === TxStatus.TxStatusDone ||
            //         queryTxResponse.txStatus === TxStatus.TxStatusExecuting ||
            //         queryTxResponse.txStatus === TxStatus.TxStatusPending
            //     ) {
            //         // Shift has already been submitted to RenVM - no need to
            //         // wait for deposit.
            //         return this;
            //     }
            // } catch (error) {
            //     console.error(error);
            //     // Ignore error
            // }

            let deposits: OrderedMap<string, UTXOWithChain> = OrderedMap();
            // const depositedAmount = (): number => {
            //     return deposits.map(item => item.utxo.value).reduce((prev, next) => prev + next, 0);
            // };

            // tslint:disable-next-line: no-constant-condition
            while (true) {
                if (promiEvent._isCancelled()) {
                    throw new Error("wait cancelled.");
                }

                if (deposits.size > 0) {
                    // Sort deposits
                    const greatestTx = deposits.filter(utxo => utxo.utxo.confirmations >= confirmations).sort((a, b) => a.utxo.amount > b.utxo.amount ? -1 : 1).first<UTXOWithChain>(undefined);

                    // Handle required minimum and maximum amount
                    const minimum = new BigNumber(10000);
                    const maximum = new BigNumber(Infinity);

                    if (greatestTx && new BigNumber(greatestTx.utxo.amount).gte(minimum) && new BigNumber(greatestTx.utxo.amount).lte(maximum)) {
                        this.utxo = greatestTx.utxo;
                        break;
                    }
                }

                try {
                    const newDeposits = await retrieveDeposits(this.network, resolveInToken(renContract), this.gatewayAddress, 0);

                    let newDeposit = false;
                    for (const deposit of newDeposits) {
                        // tslint:disable-next-line: no-non-null-assertion
                        if (!deposits.has(deposit.utxo.txHash) || deposits.get(deposit.utxo.txHash)!.utxo.confirmations !== deposit.utxo.confirmations) {
                            promiEvent.emit("deposit", deposit);
                            newDeposit = true;
                        }
                        deposits = deposits.set(deposit.utxo.txHash, deposit);
                    }
                    if (newDeposit) { continue; }
                } catch (error) {
                    // tslint:disable-next-line: no-console
                    console.error(extractError(error));
                    await sleep(1 * SECONDS);
                    continue;
                }
                await sleep(10 * SECONDS);
            }
            return this;
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    public renTxHash = (specifyUTXO?: UTXOIndex) => {
        const renTxHash = this.params.renTxHash;
        if (renTxHash) {
            return renTxHashToBase64(renTxHash);
        }

        const { contractCalls, sendToken: renContract, nonce } = this.params;

        const utxo = specifyUTXO || this.utxo;
        if (!utxo) {
            throw new Error(`Unable to generate renTxHash without UTXO. Call 'wait' first.`);
        }

        if (!nonce) {
            throw new Error(`Unable to generate renTxHash without nonce.`);
        }

        if (!contractCalls || !contractCalls.length) {
            throw new Error(`Unable to generate renTxHash without contract call details.`);
        }

        if (!renContract) {
            throw new Error(`Unable to generate renTxHash without token being transferred.`);
        }

        // Last contract call
        const { contractParams, sendTo } = contractCalls[contractCalls.length - 1];

        const gHash = generateGHash(contractParams || [], strip0x(sendTo), resolveInToken(renContract), nonce, this.network);
        const encodedGHash = toBase64(gHash);
        return generateShiftInTxHash(resolveInToken(renContract), encodedGHash, utxo);
    }

    public queryTx = async (specifyUTXO?: UTXOIndex) =>
        unmarshalMintTx(await this.renVMNetwork.queryTX(Ox(Buffer.from(this.renTxHash(specifyUTXO), "base64"))))

    public submit = (specifyUTXO?: UTXOIndex): PromiEvent<LockAndMint, { "renTxHash": [string], "status": [TxStatus] }> => {
        const promiEvent = newPromiEvent<LockAndMint, { "renTxHash": [string], "status": [TxStatus] }>();

        (async () => {
            const utxo = specifyUTXO || this.utxo;
            let renTxHash = this.params.renTxHash ? renTxHashToBase64(this.params.renTxHash) : undefined;
            if (utxo) {
                const utxoRenTxHash = this.renTxHash(utxo);
                if (renTxHash && renTxHash !== utxoRenTxHash) {
                    throw new Error(`Inconsistent RenVM transaction hash: got ${renTxHash} but expected ${utxoRenTxHash}`);
                }
                renTxHash = utxoRenTxHash;

                const { contractCalls, sendToken: renContract, nonce } = this.params;

                if (!nonce) {
                    throw new Error("Unable to submit to RenVM without nonce.");
                }

                if (!contractCalls || !contractCalls.length) {
                    throw new Error(`Unable to submit to RenVM without contract call details.`);
                }

                if (!renContract) {
                    throw new Error(`Unable to submit to RenVM without token being transferred.`);
                }

                // Last contract call
                const { contractParams, sendTo, contractFn } = contractCalls[contractCalls.length - 1];

                const fnABI = payloadToShiftInABI(contractFn, (contractParams || []));

                const encodedParameters = (new Web3("").eth.abi.encodeParameters(
                    (contractParams || []).map(i => i.type),
                    (contractParams || []).map(i => i.value),
                ));

                // Try to submit to RenVM. If that fails, see if they already
                // know about the transaction.
                try {
                    renTxHash = await this.renVMNetwork.submitShiftIn(
                        resolveInToken(renContract),
                        sendTo,
                        nonce,
                        utxo.txHash,
                        utxo.vOut.toFixed(),
                        this.network,
                        contractFn,
                        fnABI,
                        encodedParameters,
                    );
                    if (renTxHash !== utxoRenTxHash) {
                        // tslint:disable-next-line: no-console
                        console.warn(`Unexpected txHash returned from RenVM: expected ${utxoRenTxHash} but got ${renTxHash}`);
                    }
                } catch (error) {
                    console.error(error);
                    try {
                        // Check if the darknodes have already seen the transaction
                        const queryTxResponse = await this.queryTx(utxo);
                        if (queryTxResponse.txStatus === TxStatus.TxStatusNil) {
                            throw new Error(`Transaction ${renTxHash} has not been submitted previously.`);
                        }
                    } catch (errorInner) {
                        // Ignore errorInner.
                        // tslint:disable-next-line: no-console
                        console.error(errorInner);
                        throw error;
                    }
                }

                promiEvent.emit("renTxHash", renTxHash);
            } else if (!renTxHash) {
                throw new Error(`Must call 'wait' or provide UTXO or RenVM transaction hash.`);
            }

            const rawResponse = await this.renVMNetwork.waitForTX<ResponseQueryMintTx>(
                Ox(Buffer.from(renTxHash, "base64")),
                (status) => {
                    promiEvent.emit("status", status);
                },
                () => promiEvent._isCancelled(),
            );

            const response = unmarshalMintTx(rawResponse);

            // const utxoTxHash = Ox(Buffer.from(renTxHash, "base64"));
            // const onStatus = (status: TxStatus) => { promiEvent.emit("status", status); };
            // const _cancelRequested = () => promiEvent._isCancelled();

            // let result: UnmarshalledMintTx | undefined;
            // let rawResponse;
            // // tslint:disable-next-line: no-constant-condition
            // while (true) {
            //     if (_cancelRequested && _cancelRequested()) {
            //         throw new Error(`waitForTX cancelled`);
            //     }

            //     try {
            //         result = unmarshalMintTx(await this.renVMNetwork.queryTX<ResponseQueryMintTx>(utxoTxHash));
            //         if (result && result.txStatus === TxStatus.TxStatusDone) {
            //             rawResponse = result;
            //             break;
            //         } else if (onStatus && result && result.txStatus) {
            //             onStatus(result.txStatus);
            //         }
            //     } catch (error) {
            //         // tslint:disable-next-line: no-console
            //         if (String((error || {}).message).match(/(not found)|(not available)/)) {
            //             // ignore
            //         } else {
            //             // tslint:disable-next-line: no-console
            //             console.error(extractError(error));
            //             // TODO: throw unexpected errors
            //         }
            //     }
            //     await sleep(5 * SECONDS);
            // }

            this.renVMResponse = response;
            this.signature = signatureToString(fixSignature(this.renVMResponse, this.network));

            return this;

            // tslint:disable-next-line: no-use-before-declare
            // return new Signature(this.network, this.params as LockAndMintParams, response, renTxHash);
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    // tslint:disable-next-line:no-any
    public waitAndSubmit = async (web3Provider: provider, confirmations: number, txConfig?: TransactionConfig, specifyUTXO?: UTXOIndex) => {
        await this.wait(confirmations);
        const signature = await this.submit(specifyUTXO);
        return signature.submitToEthereum(web3Provider, txConfig);
    }

    // tslint:disable-next-line: no-any
    public submitToEthereum = (web3Provider: provider, txConfig?: TransactionConfig): PromiEvent<TransactionReceipt, Web3Events & RenWeb3Events> => {
        // tslint:disable-next-line: no-any
        const promiEvent = newPromiEvent<TransactionReceipt, Web3Events & RenWeb3Events>();

        (async () => {

            const web3 = new Web3(web3Provider);

            const { sendToken: renContract } = this.params;

            const manualPromiEvent = async (txHash: string) => {
                const receipt = await web3.eth.getTransactionReceipt(txHash);
                promiEvent.emit("transactionHash", txHash);

                const emitConfirmation = async () => {
                    const currentBlock = await web3.eth.getBlockNumber();
                    // tslint:disable-next-line: no-any
                    promiEvent.emit("confirmation", Math.max(0, currentBlock - receipt.blockNumber), receipt as any);
                };

                // The following section should be revised to properly
                // register the event emitter to the transaction's
                // confirmations, so that on("confirmation") works
                // as expected. This code branch only occurs if a
                // completed trade is passed to RenJS again, which
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

            if (this.thirdPartyTransaction) {
                return await manualPromiEvent(this.thirdPartyTransaction);
            }

            if (!this.renVMResponse || !this.signature) {
                throw new Error(`Unable to submit to Ethereum without signature. Call 'submit' first.`);
            }

            // Check if the signature has already been submitted
            if (renContract) {
                try {
                    const gatewayAddress = await getGatewayAddress(this.network, web3, resolveInToken(renContract));
                    const gatewayContract = new web3.eth.Contract(
                        this.network.contracts.addresses.gateways.BTCGateway.abi,
                        gatewayAddress,
                    );
                    // We can skip the `status` check and call `getPastLogs` directly - for now both are called in case
                    // the contract
                    const status = await gatewayContract.methods.status(this.renVMResponse.autogen.sighash).call();
                    if (status) {
                        const recentRegistrationEventsOld = await web3.eth.getPastLogs({
                            address: gatewayAddress,
                            fromBlock: "1",
                            toBlock: "latest",
                            // topics: [sha3("LogDarknodeRegistered(address,uint256)"), "0x000000000000000000000000" +
                            // address.slice(2), null, null] as any,
                            topics: [sha3("LogShiftIn(address,uint256,uint256,bytes32)"), null, null, this.renVMResponse.autogen.sighash] as string[],
                        });
                        const recentRegistrationEvents = await web3.eth.getPastLogs({
                            address: gatewayAddress,
                            fromBlock: "1",
                            toBlock: "latest",
                            // topics: [sha3("LogDarknodeRegistered(address,uint256)"), "0x000000000000000000000000" +
                            // address.slice(2), null, null] as any,
                            topics: [sha3("LogMint(address,uint256,uint256,bytes32)"), null, null, this.renVMResponse.autogen.sighash] as string[],
                        });
                        if (!recentRegistrationEventsOld.length && !recentRegistrationEvents.length) {
                            throw new Error(`Shift has been submitted but no log was found.`);
                        }
                        const log = recentRegistrationEventsOld[0] || recentRegistrationEvents[0];
                        return await manualPromiEvent(log.transactionHash);
                    }
                } catch (error) {
                    // tslint:disable-next-line: no-console
                    console.error(error);
                    // Continue with transaction
                }
            }

            const contractCalls = this.params.contractCalls || [];

            let tx: PromiEvent<unknown, Web3Events> | undefined;

            for (let i = 0; i < contractCalls.length; i++) {
                const contractCall = contractCalls[i];
                const last = i === contractCalls.length - 1;

                const { contractParams, contractFn, sendTo, txConfig: txConfigParam } = contractCall;

                const params = last ? [
                    ...(contractParams || []).map(value => value.value),
                    Ox(new BigNumber(this.renVMResponse.autogen.amount).toString(16)), // _amount: BigNumber
                    Ox(this.renVMResponse.autogen.nhash),
                    // Ox(this.renVMResponse.args.n), // _nHash: string
                    Ox(this.signature), // _sig: string
                ] : (contractParams || []).map(value => value.value);

                const ABI = last ? payloadToShiftInABI(contractFn, (contractParams || [])) : payloadToABI(contractFn, (contractParams || []));

                const contract = new web3.eth.Contract(ABI, sendTo);

                tx = contract.methods[contractFn](
                    ...params,
                ).send(await withDefaultAccount(web3, {
                    ...txConfigParam,
                    ...{
                        value: txConfigParam && txConfigParam.value ? txConfigParam.value.toString() : undefined,
                        gasPrice: txConfigParam && txConfigParam.gasPrice ? txConfigParam.gasPrice.toString() : undefined,
                    },

                    ...txConfig,
                }));

                if (last) {
                    // tslint:disable-next-line: no-non-null-assertion
                    forwardWeb3Events(tx!, promiEvent);
                }

                // tslint:disable-next-line: no-non-null-assertion
                await new Promise((resolve, reject) => tx!
                    .on("transactionHash", resolve)
                    .catch((error: Error) => {
                        // tslint:disable-next-line: no-console
                        try { if (ignorePromiEventError(error)) { console.error(extractError(error)); return; } } catch (_error) { /* Ignore _error */ }
                        reject(error);
                    })
                );
            }

            if (tx === undefined) {
                throw new Error(`Must provide contract call.`);
            }

            // tslint:disable-next-line: no-non-null-assertion
            return await new Promise<TransactionReceipt>((innerResolve, reject) => tx!
                .once("confirmation", (_confirmations: number, receipt: TransactionReceipt) => { innerResolve(receipt); })
                .catch((error: Error) => {
                    // tslint:disable-next-line: no-console
                    try { if (ignorePromiEventError(error)) { console.error(extractError(error)); return; } } catch (_error) { /* Ignore _error */ }
                    reject(error);
                })
            );
        })().then((receipt) => { promiEvent.resolve(receipt as TransactionReceipt); }).catch(promiEvent.reject);

        // TODO: Look into why .catch isn't being called on tx
        promiEvent.on("error", (error) => {
            // tslint:disable-next-line: no-console
            try { if (ignorePromiEventError(error)) { console.error(extractError(error)); return; } } catch (_error) { /* Ignore _error */ }
            promiEvent.reject(error);
        });

        return promiEvent;
    }

    /**
     * Alternative to `submitToEthereum` that doesn't need a web3 instance
     */
    public createTransactions = (txConfig?: TransactionConfig): TransactionConfig[] => {
        const renVMResponse = this.renVMResponse;
        const signature = this.signature;
        const contractCalls = this.params.contractCalls || [];

        if (!renVMResponse || !signature) {
            throw new Error(`Unable to create transaction without signature. Call 'submit' first.`);
        }

        return contractCalls.map((contractCall, i) => {

            const { contractParams, contractFn, sendTo, txConfig: txConfigParam } = contractCall;

            const params = i === contractCalls.length - 1 ?
                [
                    ...(contractParams || []).map(value => value.value),
                    Ox(new BigNumber(renVMResponse.autogen.amount).toString(16)), // _amount: BigNumber
                    Ox(renVMResponse.autogen.nhash),
                    // Ox(generateNHash(renVMResponse)), // _nHash: string
                    Ox(signature), // _sig: string
                ] : [...(contractParams || []).map(value => value.value)];

            const ABI = i === contractCalls.length - 1 ?
                payloadToShiftInABI(contractFn, (contractParams || [])) :
                payloadToABI(contractFn, (contractParams || []));

            // tslint:disable-next-line: no-any
            const web3: Web3 = new (Web3 as any)();
            const contract = new web3.eth.Contract(ABI);

            const data = contract.methods[contractFn](
                ...params,
            ).encodeABI();

            return {
                to: sendTo,
                data,

                ...txConfigParam,
                ...{
                    value: txConfigParam && txConfigParam.value ? txConfigParam.value.toString() : undefined,
                    gasPrice: txConfigParam && txConfigParam.gasPrice ? txConfigParam.gasPrice.toString() : undefined,
                },

                ...txConfig,
            };
        });
    }
}
