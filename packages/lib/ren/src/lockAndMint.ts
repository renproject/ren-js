import {
    Chain, LockAndMintParams, NetworkDetails, TxStatus, UnmarshalledMintTx, UTXOIndex,
    UTXOWithChain,
} from "@renproject/interfaces";
import { RenVMProvider, ResponseQueryMintTx, unmarshalMintTx } from "@renproject/rpc";
import {
    extractError, findTransactionBySigHash, fixSignature, forwardWeb3Events, generateAddress,
    generateGHash, generateMintTxHash, ignorePromiEventError, manualPromiEvent, newPromiEvent, Ox,
    parseRenContract, payloadToABI, payloadToMintABI, processLockAndMintParams, PromiEvent,
    randomNonce, RenWeb3Events, resolveInToken, retrieveConfirmations, retrieveDeposits, SECONDS,
    signatureToString, sleep, strip0x, toBase64, txHashToBase64, Web3Events, withDefaultAccount,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import Web3 from "web3";
import { TransactionConfig, TransactionReceipt } from "web3-core";
import { provider } from "web3-providers";

export class LockAndMint {
    public utxo: UTXOIndex | undefined;
    public signature: string | undefined;
    private generatedGatewayAddress: string | undefined;
    private readonly network: NetworkDetails;
    private readonly renVM: RenVMProvider;
    private readonly params: LockAndMintParams;
    private renVMResponse: UnmarshalledMintTx | undefined;

    public thirdPartyTransaction: string | undefined;

    constructor(_renVM: RenVMProvider, _network: NetworkDetails, _params: LockAndMintParams) {
        this.network = _network;
        this.renVM = _renVM;
        this.params = processLockAndMintParams(this.network, _params);
        // this.web3 = this.params.web3Provider ? new Web3(this.params.web3Provider) : undefined;

        const txHash = this.params.txHash;

        const nonce = this.params.nonce || randomNonce();
        this.params.nonce = nonce;

        if (!txHash) {
            this.validateParams();
        }
    }

    private readonly validateParams = () => {
        const params = this.params;

        // tslint:disable-next-line: prefer-const
        let { sendToken, contractCalls, nonce, ...restOfParams } = params;

        if (!contractCalls || !contractCalls.length) {
            throw new Error(`Must provide Ren transaction hash or contract call details.`);
        }

        if (!sendToken) {
            throw new Error(`Must provide Ren transaction hash or token to be transferred.`);
        }

        nonce = nonce || randomNonce();

        return { sendToken, contractCalls, nonce, ...restOfParams };
    }

    public gatewayAddress = async (specifyGatewayAddress?: string) => {
        if (specifyGatewayAddress) {
            this.generatedGatewayAddress = specifyGatewayAddress;
        }

        if (this.generatedGatewayAddress) {
            return this.generatedGatewayAddress;
        }

        const { nonce, sendToken: renContract, contractCalls } = this.validateParams();

        // Last contract call
        const { contractParams, sendTo } = contractCalls[contractCalls.length - 1];

        // TODO: Validate inputs
        const gHash = generateGHash(contractParams || [], strip0x(sendTo), resolveInToken(renContract), nonce, this.network);
        const mpkh = await this.renVM.selectPublicKey(resolveInToken(this.params.sendToken));

        const gatewayAddress = generateAddress(resolveInToken(renContract), gHash, mpkh, this.network.isTestnet);
        this.generatedGatewayAddress = gatewayAddress;

        return this.generatedGatewayAddress;
    }

    public wait = (confirmations: number, specifyDeposit?: UTXOIndex): PromiEvent<this, { "deposit": [UTXOWithChain] }> => {
        const promiEvent = newPromiEvent<this, { "deposit": [UTXOWithChain] }>();

        (async () => {
            // If the deposit has already been submitted, "wait" can be skipped.
            if (this.params.txHash || this.utxo) {
                return this;
            }

            const specifiedDeposit = specifyDeposit || this.params.deposit;

            if (specifiedDeposit) {
                let previousUtxoConfirmations = -1;
                // tslint:disable-next-line: no-constant-condition
                while (true) {
                    const utxoConfirmations = await retrieveConfirmations(this.network, {
                        chain: parseRenContract(resolveInToken(this.params.sendToken)).from,
                        hash: specifiedDeposit.txHash
                    });
                    if (utxoConfirmations > previousUtxoConfirmations) {
                        previousUtxoConfirmations = utxoConfirmations;
                        promiEvent.emit("deposit", {
                            chain: parseRenContract(resolveInToken(this.params.sendToken)).from as Chain.Bitcoin | Chain.BitcoinCash | Chain.Zcash,
                            utxo: {
                                txHash: specifiedDeposit.txHash,
                                amount: 0, // TODO: Get value
                                vOut: specifiedDeposit.vOut,
                                confirmations: utxoConfirmations,
                            }
                        });
                    }
                    if (utxoConfirmations >= confirmations) {
                        break;
                    }
                    await sleep(10);
                }
                this.utxo = specifiedDeposit;
                return this;
            }

            if (!await this.gatewayAddress()) {
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
            //         // Mint has already been submitted to RenVM - no need to
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
                    const newDeposits = await retrieveDeposits(this.network, resolveInToken(renContract), await this.gatewayAddress(), 0);

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

    public txHash = (specifyDeposit?: UTXOIndex) => {
        const txHash = this.params.txHash;
        if (txHash) {
            return txHashToBase64(txHash);
        }

        const { contractCalls, sendToken: renContract, nonce } = this.params;

        const utxo = specifyDeposit || this.params.deposit || this.utxo;
        if (!utxo) {
            throw new Error(`Unable to generate txHash without UTXO. Call 'wait' first.`);
        }

        if (!nonce) {
            throw new Error(`Unable to generate txHash without nonce.`);
        }

        if (!contractCalls || !contractCalls.length) {
            throw new Error(`Unable to generate txHash without contract call details.`);
        }

        if (!renContract) {
            throw new Error(`Unable to generate txHash without token being transferred.`);
        }

        // Last contract call
        const { contractParams, sendTo } = contractCalls[contractCalls.length - 1];

        const gHash = generateGHash(contractParams || [], strip0x(sendTo), resolveInToken(renContract), nonce, this.network);
        const encodedGHash = toBase64(gHash);
        return generateMintTxHash(resolveInToken(renContract), encodedGHash, utxo);
    }

    /**
     * queryTx requests the status of the mint from RenVM.
     */
    public queryTx = async (specifyDeposit?: UTXOIndex): Promise<UnmarshalledMintTx> =>
        unmarshalMintTx(await this.renVM.queryMintOrBurn(Ox(Buffer.from(this.txHash(specifyDeposit), "base64"))))

    /**
     * submit sends the mint details to RenVM and waits for the signature to be
     * available.
     *
     * @param {UTXOIndex} [specifyDeposit] Optionally provide the lock transaction
     *        instead of calling `wait`.
     * @returns {PromiEvent<LockAndMint, { "txHash": [string], "status": [TxStatus] }>}
     */
    public submit = (specifyDeposit?: UTXOIndex): PromiEvent<LockAndMint, { "txHash": [string], "status": [TxStatus] }> => {
        const promiEvent = newPromiEvent<LockAndMint, { "txHash": [string], "status": [TxStatus] }>();

        (async () => {
            const utxo = specifyDeposit || this.params.deposit || this.utxo;
            let txHash = this.params.txHash ? txHashToBase64(this.params.txHash) : undefined;
            if (utxo) {
                const utxoTxHash = this.txHash(utxo);
                if (txHash && txHash !== utxoTxHash) {
                    throw new Error(`Inconsistent RenVM transaction hash: got ${txHash} but expected ${utxoTxHash}`);
                }
                txHash = utxoTxHash;

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

                const fnABI = payloadToMintABI(contractFn, (contractParams || []));

                const encodedParameters = (new Web3("").eth.abi.encodeParameters(
                    (contractParams || []).map(i => i.type),
                    (contractParams || []).map(i => i.value),
                ));

                // Try to submit to RenVM. If that fails, see if they already
                // know about the transaction.
                try {


                    txHash = await this.renVM.submitMint(
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
                    if (txHash !== utxoTxHash) {
                        // tslint:disable-next-line: no-console
                        console.warn(`Unexpected txHash returned from RenVM: expected ${utxoTxHash} but got ${txHash}`);
                    }
                } catch (error) {
                    console.error(error);
                    try {
                        // Check if the darknodes have already seen the transaction
                        const queryTxResponse = await this.queryTx(utxo);
                        if (queryTxResponse.txStatus === TxStatus.TxStatusNil) {
                            throw new Error(`Transaction ${txHash} has not been submitted previously.`);
                        }
                    } catch (errorInner) {
                        // Ignore errorInner.
                        // tslint:disable-next-line: no-console
                        console.error(errorInner);
                        throw error;
                    }
                }

                promiEvent.emit("txHash", txHash);
            } else if (!txHash) {
                throw new Error(`Must call 'wait' or provide UTXO or RenVM transaction hash.`);
            }

            const rawResponse = await this.renVM.waitForTX<ResponseQueryMintTx>(
                Ox(Buffer.from(txHash, "base64")),
                (status) => {
                    promiEvent.emit("status", status);
                },
                () => promiEvent._isCancelled(),
            );

            const response = unmarshalMintTx(rawResponse);

            // const utxoTxHash = Ox(Buffer.from(txHash, "base64"));
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
            // return new Signature(this.network, this.params as LockAndMintParams, response, txHash);
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    // tslint:disable-next-line:no-any
    public waitAndSubmit = async (web3Provider: provider, confirmations: number, txConfig?: TransactionConfig, specifyDeposit?: UTXOIndex) => {
        await this.wait(confirmations);
        const signature = await this.submit(specifyDeposit);
        return signature.submitToEthereum(web3Provider, txConfig);
    }

    public findTransaction = async (web3Provider: provider): Promise<string | undefined> => {
        const web3 = new Web3(web3Provider);
        const { sendToken: renContract } = this.params;

        if (this.thirdPartyTransaction) {
            return this.thirdPartyTransaction;
        }

        if (!this.renVMResponse) {
            throw new Error(`Unable to submit to Ethereum without RenVM response. Call 'submit' first.`);
        }

        // Check if the signature has already been submitted
        if (renContract) {
            return await findTransactionBySigHash(this.network, web3, resolveInToken(renContract), this.renVMResponse.autogen.sighash);
        }
        return;
    }

    // tslint:disable-next-line: no-any
    public submitToEthereum = (web3Provider: provider, txConfig?: TransactionConfig): PromiEvent<TransactionReceipt, Web3Events & RenWeb3Events> => {
        // tslint:disable-next-line: no-any
        const promiEvent = newPromiEvent<TransactionReceipt, Web3Events & RenWeb3Events>();

        (async () => {

            const web3 = new Web3(web3Provider);

            if (!this.renVMResponse || !this.signature) {
                throw new Error(`Unable to submit to Ethereum without signature. Call 'submit' first.`);
            }

            const existingTransaction = await this.findTransaction(web3Provider);
            if (existingTransaction) {
                return await manualPromiEvent(web3, existingTransaction, promiEvent);
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

                const ABI = last ? payloadToMintABI(contractFn, (contractParams || [])) : payloadToABI(contractFn, (contractParams || []));

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
                payloadToMintABI(contractFn, (contractParams || [])) :
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
