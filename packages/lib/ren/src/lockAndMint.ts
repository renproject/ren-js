import {
    DepositCommon,
    EventType,
    LockAndMintParams,
    LockChain,
    Logger,
    MintChain,
    MintTransaction,
    newPromiEvent,
    PromiEvent,
    RenNetwork,
    TxStatus,
} from "@renproject/interfaces";
import { AbstractRenVMProvider, v2 } from "@renproject/rpc";
import {
    assertObject,
    assertType,
    emptyNonce,
    extractError,
    fromBase64,
    fromHex,
    generateGHash,
    generateNHash,
    generatePHash,
    generateSHash,
    overrideContractCalls,
    Ox,
    payloadToMintABI,
    renVMHashToBase64,
    resolveInToken,
    SECONDS,
    sleep,
    strip0x,
    toBase64,
} from "@renproject/utils";
import { EventEmitter } from "events";
import { OrderedMap } from "immutable";
import { AbiCoder } from "web3-eth-abi";

/**
 * A `LockAndMint` object tied to a particular gateway address. LockAndMint
 * should not be created directly. Instead, [[RenJS.lockAndMint]] will create a
 * `LockAndMint` object.
 *
 * `LockAndMint` extends the EventEmitter class, and emits a `"deposit"` event
 * for each new deposit that is observed. Deposits will only be watched for if
 * there is an active listener for the `"deposit"` event.
 */
export class LockAndMint<
    // tslint:disable-next-line: no-any
    Transaction = any,
    Deposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
    Asset extends string = string,
    Address = string
> extends EventEmitter {
    // Public

    public gatewayAddress: Address | undefined;

    public _queryTxResult: MintTransaction | undefined;
    public _renNetwork: RenNetwork | undefined;
    public _logger: Logger;
    public _renVM: AbstractRenVMProvider;
    public _params: LockAndMintParams<Transaction, Deposit, Asset, Address>;
    public _mpkh: Buffer | undefined;
    public _gHash: Buffer | undefined;
    public _pHash: Buffer | undefined;

    // Private
    // Deposits represents the lock deposits that have been so far.
    private deposits: OrderedMap<
        string,
        LockAndMintDeposit<Transaction, Deposit, Asset, Address>
    > = OrderedMap();
    private readonly getDepositsInstance: number;

    /**
     * Constructor.
     */
    constructor(
        _renVM: AbstractRenVMProvider,
        _params: LockAndMintParams<Transaction, Deposit, Asset, Address>,
        _logger: Logger,
    ) {
        super();

        this._logger = _logger;
        this._renVM = _renVM;
        this._params = _params;

        // tslint:disable-next-line: insecure-random
        this.getDepositsInstance = Math.random();

        const txHash = this._params.txHash;

        // Decode nonce or use empty nonce 0x0.
        const nonce = this._params.nonce
            ? fromHex(this._params.nonce)
            : emptyNonce();
        this._params.nonce = nonce;

        if (!txHash) {
            this._params.nonce = nonce;
        }

        {
            // Debug log
            const { to, from, ...restOfParams } = this._params;
            this._logger.debug("lockAndMint created:", restOfParams);
        }
    }

    /**
     * Called automatically when calling [[RenJS.lockAndMint]]. It has been split
     * from the constructor because it's asynchronous.
     */
    public readonly initialize = async (): Promise<
        LockAndMint<Transaction, Deposit, Asset, Address>
    > => {
        this._renNetwork =
            this._renNetwork ||
            ((await this._renVM.getNetwork()) as RenNetwork);

        if (!this._params.from.renNetwork) {
            this._params.from.initialize(this._renNetwork);
        }
        if (!this._params.to.renNetwork) {
            this._params.to.initialize(this._renNetwork);
        }

        this._params.contractCalls =
            this._params.contractCalls ||
            (this._params.to.contractCalls &&
                (await this._params.to.contractCalls(
                    EventType.LockAndMint,
                    this._params.asset,
                )));

        try {
            this.gatewayAddress = await this.generateGatewayAddress();
        } catch (error) {
            throw error;
        }

        // Will fetch deposits as long as there's at least one deposit.
        this.wait().catch(console.error);

        return this;
    };

    /**
     * `processDeposit` allows you to manually provide the details of a deposit
     * and returns a [[LockAndMintDeposit]] object.
     * @param deposit The deposit details in the format expected by the mint
     *                chain.
     */
    public processDeposit = (
        deposit: Deposit,
    ): LockAndMintDeposit<Transaction, Deposit, Asset, Address> => {
        if (
            !this._pHash ||
            !this._gHash ||
            !this._mpkh ||
            !this.gatewayAddress
        ) {
            throw new Error(
                "Gateway address must be generated before calling 'wait'.",
            );
        }

        // tslint:disable-next-line: no-non-null-assertion
        const depositID = this._params.from.transactionID(deposit.transaction);
        let depositObject = this.deposits.get(depositID);

        // If the confidence has increased.
        if (
            !depositObject
            // || (existingConfidenceRatio !== undefined &&
            // confidenceRatio > existingConfidenceRatio)
        ) {
            // tslint:disable-next-line: no-use-before-declare
            depositObject = new LockAndMintDeposit<
                Transaction,
                Deposit,
                Asset,
                Address
            >(
                this._renVM,
                this._params,
                this._logger,
                deposit,
                this._mpkh,
                this._gHash,
                this._pHash,
            );
            this.emit("deposit", depositObject);
            // this.deposits.set(deposit);
            this._logger.debug("new deposit:", deposit);
            this.deposits = this.deposits.set(depositID, depositObject);
        }
        return depositObject;
    };

    public addListener = <Event extends "deposit">(
        event: Event,
        listener: Event extends "deposit"
            ? (
                  deposit: LockAndMintDeposit<
                      Transaction,
                      Deposit,
                      Asset,
                      Address
                  >,
              ) => void // tslint:disable-next-line: no-any
            : never,
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

    /**
     * `on` extends [[EventEmitter.on]], modifying it to immediately return all
     * previous `"deposit"` events, on top of new events, when a new listener is
     * created.
     * @param event The name of the event to subscribe to.
     * @param listener The callback called when an event is observed.
     */
    public on = <Event extends "deposit">(
        event: Event,
        listener: Event extends "deposit"
            ? (
                  deposit: LockAndMintDeposit<
                      Transaction,
                      Deposit,
                      Asset,
                      Address
                  >,
              ) => void // tslint:disable-next-line: no-any
            : never,
    ): this => this.addListener(event, listener);

    // Private methods /////////////////////////////////////////////////////////

    private readonly generateGatewayAddress = async (
        specifyGatewayAddress?: Address,
    ): Promise<Address> => {
        if (specifyGatewayAddress || this._params.gatewayAddress) {
            this.gatewayAddress =
                specifyGatewayAddress || this._params.gatewayAddress;
        }

        if (this.gatewayAddress) {
            return this.gatewayAddress;
        }

        const { nonce, contractCalls } = this._params;

        if (!nonce) {
            throw new Error(
                `Must call 'initialize' before calling 'generateGatewayAddress'`,
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

        const tokenGatewayContract =
            this._renVM.version >= 2
                ? Ox(
                      generateSHash(
                          v2.resolveV2Contract({
                              asset: this._params.asset,
                              from: (this._params.from as unknown) as
                                  | LockChain
                                  | MintChain,
                              to: this._params.to,
                          }),
                      ),
                  )
                : await this._params.to.resolveTokenGatewayContract(
                      this._params.asset,
                  );

        this._pHash = generatePHash(contractParams || [], this._logger);

        const gHash = generateGHash(
            contractParams || [],
            sendTo,
            tokenGatewayContract,
            fromHex(nonce),
            this._renVM.version >= 2,
            this._logger,
        );
        this._gHash = gHash;
        this._mpkh = await this._renVM.selectPublicKey(
            this._params.asset,
            this._logger,
        );
        this._logger.debug("mpkh:", Ox(this._mpkh));

        const gatewayAddress = await this._params.from.getGatewayAddress(
            this._params.asset,
            this._mpkh,
            gHash,
        );
        this.gatewayAddress = gatewayAddress;
        this._logger.debug("gateway address:", this.gatewayAddress);

        return this.gatewayAddress;
    };

    private readonly wait = async (): Promise<never> => {
        if (
            !this._pHash ||
            !this._gHash ||
            !this._mpkh ||
            !this.gatewayAddress
        ) {
            throw new Error(
                "Gateway address must be generated before calling 'wait'.",
            );
        }

        // tslint:disable-next-line: no-constant-condition
        while (true) {
            const listenerCancelled = () => this.listenerCount("deposit") === 0;

            try {
                // If there are no listeners, continue.
                if (listenerCancelled()) {
                    await sleep(1 * SECONDS);
                    continue;
                }
            } catch (error) {
                this._logger.error(extractError(error));
            }

            try {
                await this._params.from.getDeposits(
                    this._params.asset,
                    this.gatewayAddress,
                    this.getDepositsInstance,
                    this.processDeposit,
                    listenerCancelled,
                );
            } catch (error) {
                this._logger.error(extractError(error));
            }

            await sleep(15 * SECONDS);
        }
    };
}

export class LockAndMintDeposit<
    // tslint:disable-next-line: no-any
    Transaction = any,
    Deposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
    Asset extends string = string,
    Address = string
> {
    public depositDetails: Deposit;

    public _queryTxResult: MintTransaction | undefined;
    public _logger: Logger;
    public _renVM: AbstractRenVMProvider;
    public _params: LockAndMintParams<Transaction, Deposit, Asset, Address>;
    public _mpkh: Buffer;
    public _gHash: Buffer;
    public _pHash: Buffer;
    public _nHash: Buffer | undefined;

    constructor(
        renVM: AbstractRenVMProvider,
        params: LockAndMintParams<Transaction, Deposit, Asset, Address>,
        logger: Logger,
        deposit: Deposit,
        mpkh: Buffer,
        gHash: Buffer,
        pHash: Buffer,
    ) {
        assertType<Buffer>("Buffer", { mpkh, gHash });
        this._renVM = renVM;
        this._params = params; // processLockAndMintParams(this.network, _params);
        this._logger = logger;
        this.depositDetails = deposit;
        this._mpkh = mpkh;
        this._gHash = gHash;
        this._pHash = pHash;

        const { txHash, contractCalls, nonce } = this._params;

        if (!nonce) {
            throw new Error(`No nonce passed in to LockAndMintDeposit`);
        }

        if (!txHash && (!contractCalls || !contractCalls.length)) {
            throw new Error(
                `Must provide Ren transaction hash or contract call details.`,
            );
        }

        this.validateParams();

        {
            // Debug log
            const { to, from, ...restOfParams } = this._params;
            this._logger.debug("lockAndMint created", restOfParams);
        }
    }

    /**
     * Return the mint's RenVM txHash.
     */
    public txHash = async (): Promise<string> => {
        if (this._logger) this._logger.info(`Calculating txHash.`);

        // Initialize chains.

        const txHash = this._params.txHash;
        if (txHash) {
            return renVMHashToBase64(txHash);
        }

        const { contractCalls, nonce } = this._params;

        const deposit = this.depositDetails;

        if (!nonce) {
            throw new Error(`Unable to generate txHash without nonce.`);
        }

        if (!contractCalls || !contractCalls.length) {
            throw new Error(
                `Unable to generate txHash without contract call details.`,
            );
        }

        // Last contract call
        const { contractParams, sendTo } = contractCalls[
            contractCalls.length - 1
        ];

        const tokenGatewayContract =
            this._renVM.version >= 2
                ? Ox(
                      generateSHash(
                          v2.resolveV2Contract({
                              asset: this._params.asset,
                              from: (this._params.from as unknown) as
                                  | LockChain
                                  | MintChain,
                              to: this._params.to,
                          }),
                      ),
                  )
                : await this._params.to.resolveTokenGatewayContract(
                      this._params.asset,
                  );

        const gHash = generateGHash(
            contractParams || [],
            sendTo,
            tokenGatewayContract,
            fromHex(nonce),
            this._renVM.version >= 2,
            this._logger,
        );

        const encodedGHash = toBase64(gHash);
        if (this._logger) {
            this._logger.debug(
                "txHash Parameters:",
                this._params.asset,
                encodedGHash,
                deposit,
            );
        }

        if (!nonce) {
            throw new Error("Unable to submit to RenVM without nonce.");
        }

        if (!contractCalls || !contractCalls.length) {
            throw new Error(
                `Unable to submit to RenVM without contract call details.`,
            );
        }

        const encodedParameters = new AbiCoder().encodeParameters(
            (contractParams || []).map((i) => i.type),
            (contractParams || []).map((i) => i.value),
        );

        // const tokenIdentifier = await this._params.to.resolveTokenGatewayContract(
        //     this._params.asset
        // );

        const transactionDetails = this._params.from.transactionRPCFormat(
            this.depositDetails.transaction,
            this._renVM.version >= 2,
        );

        const nHash = generateNHash(
            fromHex(nonce),
            transactionDetails.txid,
            transactionDetails.txindex,
            this._renVM.version >= 2,
        );
        this._nHash = nHash;

        // const pubKeyScript = await this._params.from.getPubKeyScript(
        //     this._params.asset,
        //     this._mpkh,
        //     this._gHash
        // );

        const outputHashFormat =
            this._renVM.version >= 2
                ? ""
                : this._params.from.depositV1HashString(deposit);

        const selector =
            this._renVM.version >= 2
                ? v2.resolveV2Contract({
                      asset: this._params.asset,
                      from: (this._params.from as unknown) as
                          | LockChain
                          | MintChain,
                      to: this._params.to,
                  })
                : resolveInToken(this._params);

        return toBase64(
            this._renVM.mintTxHash(
                selector,
                this._gHash,
                this._mpkh,
                nHash,
                fromHex(nonce),
                this._params.from.transactionRPCFormat(
                    deposit.transaction,
                    this._renVM.version >= 2, // v2
                ),
                deposit.amount,
                fromHex(encodedParameters),
                this._pHash,
                strip0x(sendTo),
                outputHashFormat,
            ),
        );
    };

    /**
     * queryTx requests the status of the mint from RenVM.
     */
    public queryTx = async (): Promise<MintTransaction> => {
        this._queryTxResult = (await this._renVM.queryMintOrBurn(
            fromBase64(await this.txHash()),
        )) as MintTransaction;
        return this._queryTxResult;
    };

    public _submit = async (): Promise<string> => {
        const deposit = this.depositDetails;
        const providedTxHash = this._params.txHash
            ? renVMHashToBase64(this._params.txHash)
            : undefined;

        const txHash = await this.txHash();
        if (providedTxHash && providedTxHash !== txHash) {
            throw new Error(
                `Inconsistent RenVM transaction hash: got ${providedTxHash} but expected ${txHash}`,
            );
        }

        const { contractCalls, nonce } = this._params;

        if (!nonce) {
            throw new Error("Unable to submit to RenVM without nonce.");
        }

        if (!contractCalls || !contractCalls.length) {
            throw new Error(
                `Unable to submit to RenVM without contract call details.`,
            );
        }

        // Last contract call
        const { contractParams, sendTo, contractFn } = contractCalls[
            contractCalls.length - 1
        ];

        const filteredContractParams = contractParams
            ? contractParams.filter(
                  (contractParam) => !contractParam.notInPayload,
              )
            : contractParams;

        const fnABI = payloadToMintABI(
            contractFn,
            filteredContractParams || [],
        );

        const encodedParameters = new AbiCoder().encodeParameters(
            (filteredContractParams || []).map((i) => i.type),
            (filteredContractParams || []).map((i) => i.value),
        );

        if (this._params.tags && this._params.tags.length > 1) {
            throw new Error("Providing multiple tags is not supported yet.");
        }
        const tags: [string] | [] =
            this._params.tags && this._params.tags.length
                ? [this._params.tags[0]]
                : [];

        const tokenIdentifier = await this._params.to.resolveTokenGatewayContract(
            this._params.asset,
        );

        const transactionDetails = this._params.from.transactionRPCFormat(
            this.depositDetails.transaction,
            this._renVM.version >= 2,
        );

        const nHash = generateNHash(
            fromHex(nonce),
            transactionDetails.txid,
            transactionDetails.txindex,
            this._renVM.version >= 2,
        );

        const selector =
            this._renVM.version >= 2
                ? v2.resolveV2Contract({
                      asset: this._params.asset,
                      from: (this._params.from as unknown) as
                          | LockChain
                          | MintChain,
                      to: this._params.to,
                  })
                : resolveInToken(this._params);

        const returnedTxHash = await this._renVM.submitMint(
            selector,
            this._gHash,
            this._mpkh,
            nHash,
            fromHex(nonce),
            this._params.from.transactionRPCFormat(
                deposit.transaction,
                this._renVM.version >= 2, // v2
            ),
            deposit.amount,
            fromHex(encodedParameters),
            this._pHash,
            this._renVM.version >= 2 ? strip0x(sendTo) : Ox(sendTo),
            Ox(tokenIdentifier),
            contractFn,
            fnABI,
            tags,
        );
        if (txHash && toBase64(returnedTxHash) !== txHash) {
            this._logger.warn(
                `Unexpected txHash returned from RenVM. Received: ${toBase64(
                    returnedTxHash,
                )}, expected: ${txHash}`,
            );
        }

        return toBase64(returnedTxHash);
    };

    public confirmations = async (): Promise<{
        current: number;
        target: number;
    }> => {
        return this._params.from.transactionConfidence(
            this.depositDetails.transaction,
        );
    };

    /**
     * `confirmed` will return once the deposit has reached the target number of
     * confirmations.
     *
     * It returns a PromiEvent which emits a `"confirmation"` event with the
     * current and target number of confirmations as the event parameters.
     *
     * ```ts
     * await deposit
     *  .confirmed()
     *  .on("confirmation", (confs, target) => console.log(`${confs}/${target}`))
     * ```
     */
    public confirmed = (): PromiEvent<
        LockAndMintDeposit<Transaction, Deposit, Asset, Address>,
        { confirmation: [number, number]; target: [number, number] }
    > => {
        const promiEvent = newPromiEvent<
            LockAndMintDeposit<Transaction, Deposit, Asset, Address>,
            { confirmation: [number, number]; target: [number, number] }
        >();

        (async () => {
            this._submit().catch((_error) => {
                /* ignore error */
            });

            let currentConfidenceRatio = -Infinity;
            // tslint:disable-next-line: no-constant-condition
            while (true) {
                try {
                    const confidence = await this._params.from.transactionConfidence(
                        this.depositDetails.transaction,
                    );
                    const confidenceRatio =
                        confidence.target === 0
                            ? 1
                            : confidence.current / confidence.target;
                    if (confidenceRatio > currentConfidenceRatio) {
                        currentConfidenceRatio = confidenceRatio;
                        promiEvent.emit(
                            confidenceRatio === 0 ? "target" : "confirmation",
                            confidence.current,
                            confidence.target,
                        );
                    }
                    if (confidenceRatio >= 1) {
                        break;
                    }
                    this._logger.debug(
                        `deposit confidence: ${confidence.current} / ${confidence.target}`,
                    );
                } catch (error) {
                    console.error(error);
                    this._logger.error(
                        `Error fetching transaction confidence: ` +
                            extractError(error),
                    );
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
     * `signed` waits for RenVM's signature to be available.
     *
     * It returns a PromiEvent which emits a `"txHash"` event with the deposit's
     * RenVM txHash (aka Transaction ID).
     *
     * ```ts
     * await deposit
     *  .signed()
     *  .on("txHash", (txHash) => console.log(txHash))
     * ```
     */
    public signed = (): PromiEvent<
        LockAndMintDeposit<Transaction, Deposit, Asset, Address>,
        { txHash: [string]; status: [TxStatus] }
    > => {
        const promiEvent = newPromiEvent<
            LockAndMintDeposit<Transaction, Deposit, Asset, Address>,
            { txHash: [string]; status: [TxStatus] }
        >();

        (async () => {
            const utxoTxHash = await this.txHash();

            let txHash: string;

            // Try to submit to RenVM. If that fails, see if they already
            // know about the transaction.
            try {
                txHash = await this._submit();
            } catch (error) {
                // this.logger.error(error);
                try {
                    // Check if the darknodes have already seen the transaction
                    const queryTxResponse = await this.queryTx();
                    if (queryTxResponse.txStatus === TxStatus.TxStatusNil) {
                        throw new Error(
                            `Transaction ${utxoTxHash} has not been submitted previously.`,
                        );
                    }
                    txHash = queryTxResponse.hash;
                } catch (errorInner) {
                    // Ignore errorInner.
                    this._logger.debug(errorInner);
                    throw error;
                }
            }

            promiEvent.emit("txHash", txHash);
            this._logger.debug("renVM txHash:", txHash);

            const response = await this._renVM.waitForTX<MintTransaction>(
                fromBase64(txHash),
                (status) => {
                    promiEvent.emit("status", status);
                    this._logger.debug("transaction status:", status);
                },
                () => promiEvent._isCancelled(),
            );

            this._queryTxResult = response;

            this._logger.debug(
                "signature:",
                this._queryTxResult.out && this._queryTxResult.out.signature,
            );

            return this;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    /**
     * `findTransaction` checks if the deposit signature has already been
     * submitted to the mint chain.
     */
    public findTransaction = async (): Promise<{} | undefined> => {
        if (!this._queryTxResult) {
            throw new Error(
                `Unable to find transaction without RenVM response. Call 'signed' first.`,
            );
        }

        // Check if the signature has already been submitted
        return await this._params.to.findTransaction(
            this._params.asset,
            this._queryTxResult,
        );
    };

    /**
     * `mint` submits the RenVM signature to the mint chain.
     *
     * It returns a PromiEvent and the events emitted depend on the mint chain.
     */
    public mint = (
        // tslint:disable-next-line: no-any
        override?: { [name: string]: any },
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
            if (!this._queryTxResult) {
                throw new Error(
                    `Unable to submit to Ethereum without signature. Call 'signed' first.`,
                );
            }

            const overrideArray = Object.keys(override || {}).map((key) => ({
                name: key,
                value: (override || {})[key],
            }));

            const contractCalls = overrideContractCalls(
                this._params.contractCalls || [],
                { contractParams: overrideArray },
            );

            const asset = this._params.asset;

            return await this._params.to.submitMint(
                asset,
                contractCalls,
                this._queryTxResult,
                (promiEvent as unknown) as EventEmitter,
            );
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    // Private methods /////////////////////////////////////////////////////////

    private readonly validateParams = () => {
        assertObject(
            {
                from: "object",
                to: "object",
                suggestedAmount:
                    "number | string | BigNumber | object | undefined",
                confirmations: "number | undefined",
                contractCalls: "any[]",
                gatewayAddress: "string | undefined",
                asset: "string",
                txHash: "string | undefined",
                nonce: "Buffer | string | undefined",
                tags: "string[] | undefined",
            },
            { params: this._params },
        );

        if (this._params.contractCalls) {
            this._params.contractCalls.map((contractCall) => {
                assertType<string>("string", {
                    sendTo: contractCall.sendTo,
                    contractFn: contractCall.contractFn,
                });
            });
        }
    };

    // /**
    //  * Alternative to `mint` that doesn't need a web3 instance
    //  */
    // public createTransactions = (txConfig?: any): any[] => {
    //     const renVMResponse = this.queryTxResult;
    //     const contractCalls = this.params.contractCalls || [];

    //     if (!renVMResponse || !renVMResponse.out) {
    //         throw new Error(
    //             `Unable to create transaction without signature. Call 'signed' first.`
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
