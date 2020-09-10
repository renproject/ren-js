import {
    EventType,
    LockAndMintParams,
    Logger,
    MintTransaction,
    RenNetwork,
    TxStatus,
} from "@renproject/interfaces";
import { AbstractRenVMProvider } from "@renproject/rpc";
import {
    assertObject,
    assertType,
    extractError,
    fromBase64,
    fromHex,
    generateGHash,
    generatePHash,
    ignorePromiEventError,
    newPromiEvent,
    Ox,
    parseRenContract,
    payloadToMintABI,
    PromiEvent,
    randomNonce,
    renVMHashToBase64,
    resolveInToken,
    SECONDS,
    sleep,
    toBase64,
} from "@renproject/utils";
import { EventEmitter } from "events";
import { OrderedMap } from "immutable";
import { AbiCoder } from "web3-eth-abi";

export class LockAndMint extends EventEmitter {
    public queryTxResult: MintTransaction | undefined;

    public renNetwork: RenNetwork | undefined;

    // Deposits represents the lock deposits that have been so far.
    private deposits: OrderedMap<string, LockAndMintDeposit> = OrderedMap();

    public logger: Logger;
    public gatewayAddress: string | undefined;
    public renVM: AbstractRenVMProvider;
    public params: LockAndMintParams;
    private mpkh: Buffer | undefined;
    private gHash: Buffer | undefined;
    private pHash: Buffer | undefined;

    constructor(
        _renVM: AbstractRenVMProvider,
        _params: LockAndMintParams,
        _logger: Logger
    ) {
        super();

        this.logger = _logger;
        this.renVM = _renVM;
        this.params = _params; // processLockAndMintParams(this.network, _params);

        const txHash = this.params.txHash;

        const nonce = this.params.nonce
            ? fromHex(this.params.nonce)
            : randomNonce();
        this.params.nonce = nonce;

        if (!txHash) {
            this.params.nonce = nonce || randomNonce();
        }

        {
            // Debug log
            const { to, from, ...restOfParams } = this.params;
            this.logger.debug("lockAndMint created:", restOfParams);
        }
    }

    public readonly initialize = async (): Promise<LockAndMint> => {
        this.renNetwork =
            this.renNetwork || ((await this.renVM.getNetwork()) as RenNetwork);

        if (!this.params.from.renNetwork) {
            this.params.from.initialize(this.renNetwork);
        }
        if (!this.params.to.renNetwork) {
            this.params.to.initialize(this.renNetwork);
        }

        this.params.contractCalls =
            this.params.contractCalls ||
            (this.params.to.contractCalls &&
                (await this.params.to.contractCalls(
                    EventType.LockAndMint,
                    this.params.asset
                )));

        try {
            this.gatewayAddress = await this.generateGatewayAddress();
        } catch (error) {
            throw error;
        }

        this.wait().catch(console.error);

        return this;
    };

    private readonly generateGatewayAddress = async (
        specifyGatewayAddress?: string
    ): Promise<string> => {
        if (specifyGatewayAddress || this.params.gatewayAddress) {
            this.gatewayAddress =
                specifyGatewayAddress || this.params.gatewayAddress;
        }

        if (this.gatewayAddress) {
            return this.gatewayAddress;
        }

        const { nonce, contractCalls } = this.params;

        if (!nonce) {
            throw new Error(
                `Must call 'initialize' before calling 'generateGatewayAddress'`
            );
        }

        if (!contractCalls) {
            throw new Error(`Must provide contract call details`);
        }

        // Last contract call
        const { contractParams, sendTo } = contractCalls[
            contractCalls.length - 1
        ];

        // const isTestnet =
        //     this.renNetwork !== RenNetwork.Mainnet &&
        //     this.renNetwork !== RenNetwork.Chaosnet;

        const tokenGatewayContract = await this.params.to.resolveTokenGatewayContract(
            resolveInToken(this.params)
        );

        this.pHash = generatePHash(contractParams || [], this.logger);

        // TODO: Validate inputs.
        this.gHash = generateGHash(
            contractParams || [],
            sendTo,
            tokenGatewayContract,
            fromHex(nonce),
            this.renVM.version >= 2,
            this.logger
        );
        this.mpkh = await this.renVM.selectPublicKey(
            resolveInToken(this.params),
            this.logger
        );
        this.logger.debug("mpkh:", Ox(this.mpkh));

        const gatewayAddress = await this.params.from.getGatewayAddress(
            this.params.asset,
            this.mpkh,
            this.gHash
        );
        this.gatewayAddress = gatewayAddress;
        this.logger.debug("gateway address:", this.gatewayAddress);

        return this.gatewayAddress;
    };

    public processTransaction = async (transaction: {}): Promise<
        LockAndMintDeposit
    > => {
        if (!this.pHash || !this.gHash || !this.mpkh || !this.gatewayAddress) {
            throw new Error(
                "Gateway address must be generated before calling 'wait'."
            );
        }

        // tslint:disable-next-line: no-non-null-assertion
        const depositID = this.params.from.transactionID(transaction);
        let deposit = this.deposits.get(depositID);

        // If the confidence has increased.
        if (
            !deposit
            // || (existingConfidenceRatio !== undefined &&
            // confidenceRatio > existingConfidenceRatio)
        ) {
            // tslint:disable-next-line: no-use-before-declare
            deposit = new LockAndMintDeposit(
                this.renVM,
                this.params,
                this.logger,
                transaction,
                this.mpkh,
                this.gHash,
                this.pHash
            );
            this.emit("deposit", deposit);
            // this.deposits.set(deposit);
            this.logger.debug("new deposit:", transaction);
            this.deposits = this.deposits.set(depositID, deposit);
        }
        return deposit;
    };

    public wait = async (): Promise<never> => {
        if (!this.pHash || !this.gHash || !this.mpkh || !this.gatewayAddress) {
            throw new Error(
                "Gateway address must be generated before calling 'wait'."
            );
        }

        // tslint:disable-next-line: no-constant-condition
        while (true) {
            // TODO: Handle cancelling.
            // if (this._isCancelled()) {
            //     throw new Error("Wait cancelled.");
            // }

            try {
                const newDeposits = await this.params.from.getDeposits(
                    this.params.asset,
                    this.gatewayAddress
                );

                for (const deposit of newDeposits) {
                    await this.processTransaction(deposit);
                }
            } catch (error) {
                this.logger.error(extractError(error));
            }
            await sleep(15 * SECONDS);
        }
    };

    public on = <Event extends "deposit">(
        event: Event,
        // tslint:disable-next-line: no-any
        listener: Event extends "deposit"
            ? (deposit: LockAndMintDeposit) => void // tslint:disable-next-line: no-any
            : never
    ): this => {
        // Emit previous deposit events.
        if (event === "deposit") {
            this.deposits.map((deposit) => {
                listener(deposit);
            });
        }

        super.on(event, listener);
        return this;
    };
}

export class LockAndMintDeposit {
    public deposit: {};
    public queryTxResult: MintTransaction | undefined;
    public logger: Logger;
    // private gatewayAddress: string | undefined;
    public renVM: AbstractRenVMProvider;
    public params: LockAndMintParams;
    private readonly mpkh: Buffer;
    private readonly gHash: Buffer;
    private readonly pHash: Buffer;

    public thirdPartyTransaction: {} | undefined;

    constructor(
        renVM: AbstractRenVMProvider,
        params: LockAndMintParams,
        logger: Logger,
        deposit: {},
        mpkh: Buffer,
        gHash: Buffer,
        pHash: Buffer
    ) {
        assertType("Buffer", { mpkh, gHash });
        this.renVM = renVM;
        this.params = params; // processLockAndMintParams(this.network, _params);
        this.logger = logger;
        this.deposit = deposit;
        this.mpkh = mpkh;
        this.gHash = gHash;
        this.pHash = pHash;

        const { txHash, contractCalls, nonce } = this.params;

        if (!this.params.nonce) {
            throw new Error(`No nonce passed in to LockAndMintDeposit`);
        }

        if (!txHash && (!contractCalls || !contractCalls.length)) {
            throw new Error(
                `Must provide Ren transaction hash or contract call details.`
            );
        }

        this.params.nonce = nonce || randomNonce();

        this.validateParams();

        {
            // Debug log
            const { to, from, ...restOfParams } = this.params;
            this.logger.debug("lockAndMint created", restOfParams);
        }
    }

    private readonly validateParams = () => {
        assertObject(
            {
                from: "object",
                to: "object",
                suggestedAmount: "number | string | object | undefined",
                confirmations: "number | undefined",
                contractCalls: "any[]",
                gatewayAddress: "string | undefined",
                asset: "string",
                txHash: "string | undefined",
                nonce: "Buffer | string | undefined",
                tags: "string[] | undefined",
            },
            { params: this.params }
        );

        if (this.params.contractCalls) {
            this.params.contractCalls.map((contractCall) => {
                assertType("string", {
                    sendTo: contractCall.sendTo,
                    contractFn: contractCall.contractFn,
                });
            });
        }
    };

    public txHash = async (): Promise<string> => {
        if (this.logger) this.logger.info(`Calculating txHash...`);

        // Initialize chains.

        const txHash = this.params.txHash;
        if (txHash) {
            return renVMHashToBase64(txHash);
        }

        const { contractCalls, nonce } = this.params;

        const deposit = this.deposit;

        if (!nonce) {
            throw new Error(`Unable to generate txHash without nonce.`);
        }

        if (!contractCalls || !contractCalls.length) {
            throw new Error(
                `Unable to generate txHash without contract call details.`
            );
        }

        // Last contract call
        const { contractParams, sendTo } = contractCalls[
            contractCalls.length - 1
        ];

        const tokenGatewayContract = await this.params.to.resolveTokenGatewayContract(
            resolveInToken(this.params)
        );

        // TODO: Validate inputs.
        const gHash = generateGHash(
            contractParams || [],
            sendTo,
            tokenGatewayContract,
            fromHex(nonce),
            this.renVM.version >= 2,
            this.logger
        );

        const encodedGHash = toBase64(gHash);
        if (this.logger) {
            this.logger.debug(
                "txHash Parameters:",
                resolveInToken(this.params),
                encodedGHash,
                deposit
            );
        }

        if (!nonce) {
            throw new Error("Unable to submit to RenVM without nonce.");
        }

        if (!contractCalls || !contractCalls.length) {
            throw new Error(
                `Unable to submit to RenVM without contract call details.`
            );
        }

        const encodedParameters = new AbiCoder().encodeParameters(
            (contractParams || []).map((i) => i.type),
            (contractParams || []).map((i) => i.value)
        );

        // Try to submit to RenVM. If that fails, see if they already
        // know about the transaction.
        if (this.params.tags && this.params.tags.length > 1) {
            throw new Error("Providing multiple tags is not supported yet.");
        }

        const tokenIdentifier = await this.params.to.resolveTokenGatewayContract(
            parseRenContract(resolveInToken(this.params)).asset
        );

        const nHash = this.params.from.generateNHash(
            fromHex(nonce),
            this.deposit,
            this.renVM.version >= 2
        );

        const pubKeyScript = await this.params.from.getPubKeyScript(
            this.params.asset,
            this.mpkh,
            this.gHash
        );

        const outputHashFormat = this.params.from.transactionHashString(
            deposit
        );

        return toBase64(
            this.renVM.mintTxHash(
                resolveInToken(this.params),
                this.gHash,
                this.mpkh,
                nHash,
                fromHex(nonce),
                this.params.from.transactionRPCFormat(
                    deposit,
                    pubKeyScript,
                    this.renVM.version >= 2 // v2
                ),
                fromHex(encodedParameters),
                this.pHash,
                sendTo,
                tokenIdentifier,
                outputHashFormat
            )
        );
    };

    /**
     * queryTx requests the status of the mint from RenVM.
     */
    public queryTx = async (): Promise<MintTransaction> => {
        this.queryTxResult = (await this.renVM.queryMintOrBurn(
            fromBase64(await this.txHash())
        )) as MintTransaction;
        return this.queryTxResult;
    };

    public submit = async (): Promise<string> => {
        const deposit = this.deposit;
        const providedTxHash = this.params.txHash
            ? renVMHashToBase64(this.params.txHash)
            : undefined;

        const txHash = await this.txHash();
        if (providedTxHash && providedTxHash !== txHash) {
            throw new Error(
                `Inconsistent RenVM transaction hash: got ${providedTxHash} but expected ${txHash}`
            );
        }

        const { contractCalls, nonce } = this.params;

        if (!nonce) {
            throw new Error("Unable to submit to RenVM without nonce.");
        }

        if (!contractCalls || !contractCalls.length) {
            throw new Error(
                `Unable to submit to RenVM without contract call details.`
            );
        }

        // Last contract call
        const { contractParams, sendTo, contractFn } = contractCalls[
            contractCalls.length - 1
        ];

        const fnABI = payloadToMintABI(contractFn, contractParams || []);

        const encodedParameters = new AbiCoder().encodeParameters(
            (contractParams || []).map((i) => i.type),
            (contractParams || []).map((i) => i.value)
        );

        if (this.params.tags && this.params.tags.length > 1) {
            throw new Error("Providing multiple tags is not supported yet.");
        }
        const tags: [string] | [] =
            this.params.tags && this.params.tags.length
                ? [this.params.tags[0]]
                : [];

        const tokenIdentifier = await this.params.to.resolveTokenGatewayContract(
            parseRenContract(resolveInToken(this.params)).asset
        );

        const nHash = this.params.from.generateNHash(
            fromHex(nonce),
            this.deposit,
            this.renVM.version >= 2
        );

        const pubKeyScript = await this.params.from.getPubKeyScript(
            this.params.asset,
            this.mpkh,
            this.gHash
        );

        const returnedTxHash = await this.renVM.submitMint(
            resolveInToken(this.params),
            this.gHash,
            this.mpkh,
            nHash,
            fromHex(nonce),
            this.params.from.transactionRPCFormat(
                deposit,
                pubKeyScript,
                this.renVM.version >= 2 // v2
            ),
            fromHex(encodedParameters),
            this.pHash,
            Ox(sendTo),
            Ox(tokenIdentifier),
            contractFn,
            fnABI,
            tags
        );
        if (txHash && toBase64(returnedTxHash) !== txHash) {
            this.logger.warn(
                `Unexpected txHash returned from RenVM. Received: ${toBase64(
                    returnedTxHash
                )}, expected: ${txHash}`
            );
        }

        return toBase64(returnedTxHash);
    };

    public confirmed = (): PromiEvent<
        LockAndMintDeposit,
        { confirmation: [number, number] }
    > => {
        const promiEvent = newPromiEvent<
            LockAndMintDeposit,
            { confirmation: [number, number] }
        >();

        (async () => {
            this.submit().catch((_error) => {
                /* ignore error */
            });

            let currentConfidenceRatio = 0;
            // tslint:disable-next-line: no-constant-condition
            while (true) {
                try {
                    const confidence = await this.params.from.transactionConfidence(
                        this.deposit
                    );
                    const confidenceRatio =
                        confidence.current / confidence.target;
                    if (confidenceRatio > currentConfidenceRatio) {
                        currentConfidenceRatio = confidenceRatio;
                        promiEvent.emit(
                            "confirmation",
                            confidence.current,
                            confidence.target
                        );
                    }
                    if (confidenceRatio >= 1) {
                        break;
                    }
                    this.logger.debug(
                        `deposit confidence: ${confidence.current} / ${confidence.target}`
                    );
                } catch (error) {
                    this.logger.error(extractError(error));
                }
                await sleep(15 * SECONDS);
            }
            return this;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    /**
     * submit sends the mint details to RenVM and waits for the signature to be
     * available.
     *
     * @param {{}} [specifyDeposit] Optionally provide the lock transaction
     *        instead of calling `wait`.
     * @returns {PromiEvent<LockAndMint, { "txHash": [string], "status": [TxStatus] }>}
     */
    public signed = (): PromiEvent<
        LockAndMintDeposit,
        { txHash: [string]; status: [TxStatus] }
    > => {
        const promiEvent = newPromiEvent<
            LockAndMintDeposit,
            { txHash: [string]; status: [TxStatus] }
        >();

        (async () => {
            // const deposit = this.deposit;
            // let txHash = this.params.txHash
            //     ? renVMHashToBase64(this.params.txHash)
            //     : undefined;

            const utxoTxHash = await this.txHash();
            // if (txHash && txHash !== utxoTxHash) {
            //     throw new Error(
            //         `Inconsistent RenVM transaction hash: got ${txHash} but expected ${utxoTxHash}`
            //     );
            // }
            // txHash = utxoTxHash;

            let txHash: string;

            // Try to submit to RenVM. If that fails, see if they already
            // know about the transaction.
            try {
                txHash = await this.submit();
                if (txHash !== utxoTxHash) {
                    this.logger.warn(
                        `Unexpected txHash returned from RenVM: expected ${utxoTxHash} but got ${txHash}`
                    );
                }
            } catch (error) {
                // this.logger.error(error);
                try {
                    // Check if the darknodes have already seen the transaction
                    const queryTxResponse = await this.queryTx();
                    if (queryTxResponse.txStatus === TxStatus.TxStatusNil) {
                        throw new Error(
                            `Transaction ${utxoTxHash} has not been submitted previously.`
                        );
                    }
                    txHash = queryTxResponse.hash;
                } catch (errorInner) {
                    // Ignore errorInner.
                    this.logger.debug(errorInner);
                    throw error;
                }
            }

            promiEvent.emit("txHash", txHash);
            this.logger.debug("renVM txHash:", txHash);

            const response = await this.renVM.waitForTX<MintTransaction>(
                fromBase64(txHash),
                (status) => {
                    promiEvent.emit("status", status);
                    this.logger.debug("transaction status:", status);
                },
                () => promiEvent._isCancelled()
            );

            this.queryTxResult = response;

            this.logger.debug(
                "signature:",
                this.queryTxResult.out && this.queryTxResult.out.signature
            );

            return this;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    public findTransaction = async (): Promise<{} | undefined> => {
        if (this.thirdPartyTransaction) {
            return this.thirdPartyTransaction;
        }

        if (!this.queryTxResult) {
            throw new Error(
                `Unable to find transaction without RenVM response. Call 'signed' first.`
            );
        }

        // Check if the signature has already been submitted
        return await this.params.to.findTransaction(
            resolveInToken(this.params),
            this.queryTxResult
        );
    };

    public mint = (
        // tslint:disable-next-line: no-any
        _txConfig?: any
        // tslint:disable-next-line: no-any
    ): PromiEvent<any, { [key: string]: any }> => {
        // tslint:disable-next-line: no-any
        const promiEvent = newPromiEvent<
            // tslint:disable-next-line: no-any
            any,
            // tslint:disable-next-line: no-any
            { [key: string]: any }
        >();

        (async () => {
            if (!this.queryTxResult) {
                throw new Error(
                    `Unable to submit to Ethereum without signature. Call 'submit' first.`
                );
            }

            const asset = this.params.asset; // parseRenContract(this.queryTxResult.to).asset;

            return this.params.to.submitMint(
                asset,
                this.params.contractCalls || [],
                this.queryTxResult,
                (promiEvent as unknown) as EventEmitter
            );
        })()
            .then((transaction) => {
                promiEvent.resolve(transaction);
            })
            .catch(promiEvent.reject);

        // TODO: Look into why .catch isn't being called on tx
        promiEvent.on("error", (error) => {
            try {
                if (ignorePromiEventError(error)) {
                    this.logger.error(extractError(error));
                    return;
                }
            } catch (_error) {
                /* Ignore _error */
            }
            this.logger.debug("promiEvent.on('error') forwarded", error);
            promiEvent.reject(error);
        });

        return promiEvent;
    };

    // /**
    //  * Alternative to `mint` that doesn't need a web3 instance
    //  */
    // public createTransactions = (txConfig?: any): any[] => {
    //     const renVMResponse = this.queryTxResult;
    //     const contractCalls = this.params.contractCalls || [];

    //     if (!renVMResponse || !renVMResponse.out) {
    //         throw new Error(
    //             `Unable to create transaction without signature. Call 'submit' first.`
    //         );
    //     }

    //     const signature = renVMResponse.out.signature;

    //     return contractCalls.map((contractCall, i) => {
    //         const {
    //             contractParams,
    //             contractFn,
    //             sendTo,
    //             txConfig: txConfigParam,
    //         } = contractCall;

    //         const params =
    //             i === contractCalls.length - 1
    //                 ? [
    //                       ...(contractParams || []).map((value) => value.value),
    //                       Ox(
    //                           new BigNumber(
    //                               renVMResponse.autogen.amount
    //                           ).toString(16)
    //                       ), // _amount: BigNumber
    //                       Ox(renVMResponse.autogen.nhash),
    //                       // Ox(generateNHash(renVMResponse)), // _nHash: string
    //                       Ox(signature), // _sig: string
    //                   ]
    //                 : [...(contractParams || []).map((value) => value.value)];

    //         const ABI =
    //             i === contractCalls.length - 1
    //                 ? payloadToMintABI(contractFn, contractParams || [])
    //                 : payloadToABI(contractFn, contractParams || []);

    //         // tslint:disable-next-line: no-any
    //         const web3: Web3 = new (Web3 as any)();
    //         const contract = new web3.eth.Contract(ABI);

    //         const data = contract.methods[contractFn](...params).encodeABI();

    //         const rawTransaction = {
    //             to: sendTo,
    //             data,

    //             ...txConfigParam,
    //             ...{
    //                 value:
    //                     txConfigParam && txConfigParam.value
    //                         ? txConfigParam.value.toString()
    //                         : undefined,
    //                 gasPrice:
    //                     txConfigParam && txConfigParam.gasPrice
    //                         ? txConfigParam.gasPrice.toString()
    //                         : undefined,
    //             },

    //             ...txConfig,
    //         };

    //         this.logger.debug(
    //             "Raw transaction created",
    //             contractFn,
    //             sendTo,
    //             rawTransaction
    //         );

    //         return rawTransaction;
    //     });
    // };
}
