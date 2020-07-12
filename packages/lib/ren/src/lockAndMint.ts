import { RenNetworkDetails } from "@renproject/contracts";
import {
    LockAndMintParams, Logger, TxStatus, UnmarshalledMintTx, UTXOIndex, UTXOWithChain,
} from "@renproject/interfaces";
import { RenVMProvider, ResponseQueryMintTx, unmarshalMintTx } from "@renproject/rpc";
import {
    extractError, findTransactionBySigHash, fixSignature, forwardWeb3Events, generateAddress,
    generateGHash, generateMintTxHash, ignorePromiEventError, manualPromiEvent, newPromiEvent, Ox,
    payloadToABI, payloadToMintABI, processLockAndMintParams, PromiEvent, randomNonce,
    RenWeb3Events, resolveInToken, retrieveDeposits, SECONDS, signatureToString, sleep, strip0x,
    toBase64, txHashToBase64, waitForConfirmations, Web3Events, withDefaultAccount,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import Web3 from "web3";
import { TransactionConfig, TransactionReceipt } from "web3-core";
import { provider } from "web3-providers";

export class LockAndMint {
    public utxo: UTXOIndex | undefined;
    public signature: string | undefined;
    public queryTxResult: UnmarshalledMintTx | undefined;
    private generatedGatewayAddress: string | undefined;
    private readonly network: RenNetworkDetails;
    private readonly renVM: RenVMProvider;
    private readonly params: LockAndMintParams;
    private readonly logger: Logger;

    public thirdPartyTransaction: string | undefined;

    constructor(_renVM: RenVMProvider, _network: RenNetworkDetails, _params: LockAndMintParams, _logger: Logger) {
        this.logger = _logger;
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

        { // Debug log
            const { web3Provider, ...restOfParams } = this.params;
            this.logger.debug("lockAndMint created", { web3: web3Provider ? "[Web3 provider]" : web3Provider, ...restOfParams });
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
        if (specifyGatewayAddress || this.params.gatewayAddress) {
            this.generatedGatewayAddress = specifyGatewayAddress || this.params.gatewayAddress;
        }

        if (this.generatedGatewayAddress) {
            return this.generatedGatewayAddress;
        }

        const { nonce, sendToken: renContract, contractCalls } = this.validateParams();

        // Last contract call
        const { contractParams, sendTo } = contractCalls[contractCalls.length - 1];

        // TODO: Validate inputs.
        const gHash = generateGHash(contractParams || [], strip0x(sendTo), resolveInToken(renContract), nonce, this.network, this.logger);
        const mpkh = await this.renVM.selectPublicKey(resolveInToken(this.params.sendToken), this.logger);
        this.logger.debug("MPKH", mpkh.toString("hex"));

        const gatewayAddress = generateAddress(resolveInToken(renContract), gHash, mpkh, this.network.isTestnet);
        this.generatedGatewayAddress = gatewayAddress;
        this.logger.debug("Gateway Address", this.generatedGatewayAddress);

        return this.generatedGatewayAddress;
    }

    public wait = (confirmations: number, specifyDeposit?: UTXOIndex): PromiEvent<this, { "deposit": [UTXOWithChain] }> => {
        const promiEvent = newPromiEvent<this, { "deposit": [UTXOWithChain] }>();

        (async () => {
            // If the deposit has already been submitted, "wait" can be skipped.
            if (this.params.txHash || this.utxo) {
                return this;
            }

            let specifiedDeposit = specifyDeposit || this.params.deposit;

            if (specifiedDeposit) {
                const onDeposit = (utxo: UTXOWithChain) => {
                    promiEvent.emit("deposit", utxo);
                    this.logger.debug("New Deposit", utxo);
                };
                specifiedDeposit = await waitForConfirmations(this.network, resolveInToken(this.params.sendToken), specifiedDeposit, confirmations, await this.gatewayAddress(), onDeposit);
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

            let deposits: OrderedMap<string, UTXOWithChain> = OrderedMap();

            // tslint:disable-next-line: no-constant-condition
            while (true) {
                if (promiEvent._isCancelled()) {
                    throw new Error("Wait cancelled.");
                }

                if (deposits.size > 0) {
                    // Sort deposits
                    const greatestTx = deposits.filter(utxo => utxo.utxo.confirmations >= confirmations).sort((a, b) => a.utxo.amount > b.utxo.amount ? 1 : -1).first<UTXOWithChain>(undefined);

                    // Handle required minimum and maximum amount
                    const minimum = new BigNumber(16001);
                    const maximum = new BigNumber(Infinity);

                    if (greatestTx && new BigNumber(greatestTx.utxo.amount).gte(minimum) && new BigNumber(greatestTx.utxo.amount).lte(maximum)) {
                        this.utxo = greatestTx.utxo;
                        this.logger.debug("Selected Deposit", this.utxo);
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
                            this.logger.debug("New Deposit", deposit);
                            newDeposit = true;
                        }
                        deposits = deposits.set(deposit.utxo.txHash, deposit);
                    }
                    if (newDeposit) { continue; }
                } catch (error) {
                    this.logger.error(extractError(error));
                    await sleep(1 * SECONDS);
                    continue;
                }
                await sleep(15 * SECONDS);
            }
            return this;
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    public txHash = (specifyDeposit?: UTXOIndex) => {
        if (this.logger) this.logger.info(`Calculating txHash...`);

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

        const gHash = generateGHash(contractParams || [], strip0x(sendTo), resolveInToken(renContract), nonce, this.network, this.logger);
        const encodedGHash = toBase64(gHash);
        if (this.logger) this.logger.debug("txHash Parameters", resolveInToken(renContract), encodedGHash, utxo);
        return generateMintTxHash(resolveInToken(renContract), encodedGHash, utxo, this.logger);
    }

    /**
     * queryTx requests the status of the mint from RenVM.
     */
    public queryTx = async (specifyDeposit?: UTXOIndex): Promise<UnmarshalledMintTx> => {
        const queryTxResult = unmarshalMintTx(await this.renVM.queryMintOrBurn(Ox(Buffer.from(this.txHash(specifyDeposit), "base64"))));
        this.queryTxResult = queryTxResult;
        return queryTxResult;
    }

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

                    if (this.params.tags && this.params.tags.length > 1) {
                        throw new Error("Providing multiple tags is not supported yet.");
                    }
                    const tags: [string] | [] = this.params.tags && this.params.tags.length ? [this.params.tags[0]] : [];

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
                        tags,
                    );
                    if (txHash !== utxoTxHash) {
                        this.logger.warn(`Unexpected txHash returned from RenVM: expected ${utxoTxHash} but got ${txHash}`);
                    }
                } catch (error) {
                    // this.logger.error(error);
                    try {
                        // Check if the darknodes have already seen the transaction
                        const queryTxResponse = await this.queryTx(utxo);
                        if (queryTxResponse.txStatus === TxStatus.TxStatusNil) {
                            throw new Error(`Transaction ${txHash} has not been submitted previously.`);
                        }
                    } catch (errorInner) {
                        // Ignore errorInner.
                        // this.logger.error(errorInner);
                        this.logger.debug(error);
                        throw error;
                    }
                }

                promiEvent.emit("txHash", txHash);
                this.logger.debug("RenVM txHash", txHash);
            } else if (!txHash) {
                throw new Error(`Must call 'wait' or provide UTXO or RenVM transaction hash.`);
            }

            const rawResponse = await this.renVM.waitForTX<ResponseQueryMintTx>(
                Ox(Buffer.from(txHash, "base64")),
                (status) => {
                    promiEvent.emit("status", status);
                    this.logger.debug("Transaction Status", status);
                },
                () => promiEvent._isCancelled(),
            );

            const response = unmarshalMintTx(rawResponse);

            this.queryTxResult = response;
            this.signature = signatureToString(fixSignature(this.queryTxResult, this.network, this.logger));

            this.logger.debug("Signature", this.signature);

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

    public findTransaction = async (web3Provider?: provider): Promise<string | undefined> => {
        web3Provider = web3Provider || this.params.web3Provider;
        if (!web3Provider) {
            throw new Error(`Unable to find transaction without web3Provider.`);
        }
        const web3 = new Web3(web3Provider);
        const { sendToken: renContract } = this.params;

        if (this.thirdPartyTransaction) {
            return this.thirdPartyTransaction;
        }

        if (!this.queryTxResult) {
            throw new Error(`Unable to find transaction without RenVM response. Call 'submit' first.`);
        }

        // Check if the signature has already been submitted
        if (renContract) {
            return await findTransactionBySigHash(this.network, web3, resolveInToken(renContract), this.queryTxResult.autogen.sighash, this.logger);
        }
        return;
    }

    // tslint:disable-next-line: no-any
    public submitToEthereum = (web3Provider?: provider, txConfig?: TransactionConfig): PromiEvent<TransactionReceipt, Web3Events & RenWeb3Events> => {
        web3Provider = web3Provider || this.params.web3Provider;
        if (!web3Provider) {
            throw new Error(`Unable to submit to Ethereum without web3Provider.`);
        }

        // tslint:disable-next-line: no-any
        const promiEvent = newPromiEvent<TransactionReceipt, Web3Events & RenWeb3Events>();

        (async () => {

            const web3 = new Web3(web3Provider);

            if (!this.queryTxResult || !this.signature) {
                throw new Error(`Unable to submit to Ethereum without signature. Call 'submit' first.`);
            }

            const existingTransaction = await this.findTransaction(web3Provider);
            if (existingTransaction) {
                this.logger.debug("Signature found in Ethereum transaction", existingTransaction);
                return await manualPromiEvent(web3, existingTransaction, promiEvent);
            }

            const contractCalls = this.params.contractCalls || [];

            let tx: PromiEvent<unknown, Web3Events> | undefined;

            for (let i = 0; i < contractCalls.length; i++) {
                const contractCall = contractCalls[i];
                const last = i === contractCalls.length - 1;

                const { contractParams, contractFn, sendTo, txConfig: txConfigParam } = contractCall;

                const callParams = last ? [
                    ...(contractParams || []).map(value => value.value),
                    Ox(new BigNumber(this.queryTxResult.autogen.amount).toString(16)), // _amount: BigNumber
                    Ox(this.queryTxResult.autogen.nhash),
                    // Ox(this.renVMResponse.args.n), // _nHash: string
                    Ox(this.signature), // _sig: string
                ] : (contractParams || []).map(value => value.value);

                const ABI = last ? payloadToMintABI(contractFn, (contractParams || [])) : payloadToABI(contractFn, (contractParams || []));

                const contract = new web3.eth.Contract(ABI, sendTo);

                const config = await withDefaultAccount(web3, {
                    ...txConfigParam,
                    ...{
                        value: txConfigParam && txConfigParam.value ? txConfigParam.value.toString() : undefined,
                        gasPrice: txConfigParam && txConfigParam.gasPrice ? txConfigParam.gasPrice.toString() : undefined,
                    },

                    ...txConfig,
                });

                this.logger.debug("Calling Ethereum contract", contractFn, sendTo, ...callParams, config);

                tx = contract.methods[contractFn](
                    ...callParams,
                ).send(config);

                if (last) {
                    // tslint:disable-next-line: no-non-null-assertion
                    forwardWeb3Events(tx!, promiEvent);
                }

                // tslint:disable-next-line: no-non-null-assertion
                const ethereumTxHash = await new Promise((resolve, reject) => tx!
                    .on("transactionHash", resolve)
                    .catch((error: Error) => {
                        try { if (ignorePromiEventError(error)) { this.logger.error(extractError(error)); return; } } catch (_error) { /* Ignore _error */ }
                        reject(error);
                    })
                );
                this.logger.debug("Ethereum txHash", ethereumTxHash);
            }

            if (tx === undefined) {
                throw new Error(`Must provide contract call.`);
            }

            // tslint:disable-next-line: no-non-null-assertion
            return await new Promise<TransactionReceipt>((innerResolve, reject) => tx!
                .once("confirmation", (_confirmations: number, receipt: TransactionReceipt) => { innerResolve(receipt); })
                .catch((error: Error) => {
                    try { if (ignorePromiEventError(error)) { this.logger.error(extractError(error)); return; } } catch (_error) { /* Ignore _error */ }
                    reject(error);
                })
            );
        })().then((receipt) => { promiEvent.resolve(receipt as TransactionReceipt); }).catch(promiEvent.reject);

        // TODO: Look into why .catch isn't being called on tx
        promiEvent.on("error", (error) => {
            try { if (ignorePromiEventError(error)) { this.logger.error(extractError(error)); return; } } catch (_error) { /* Ignore _error */ }
            this.logger.debug("promiEvent.on('error') forwarded", error);
            promiEvent.reject(error);
        });

        return promiEvent;
    }

    /**
     * Alternative to `submitToEthereum` that doesn't need a web3 instance
     */
    public createTransactions = (txConfig?: TransactionConfig): TransactionConfig[] => {
        const renVMResponse = this.queryTxResult;
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

            const rawTransaction = {
                to: sendTo,
                data,

                ...txConfigParam,
                ...{
                    value: txConfigParam && txConfigParam.value ? txConfigParam.value.toString() : undefined,
                    gasPrice: txConfigParam && txConfigParam.gasPrice ? txConfigParam.gasPrice.toString() : undefined,
                },

                ...txConfig,
            };

            this.logger.debug("Raw transaction created", contractFn, sendTo, rawTransaction);

            return rawTransaction;
        });
    }
}
