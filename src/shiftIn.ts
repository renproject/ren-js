import {
    newPromiEvent, Ox, PromiEvent, ShiftInParams, ShiftInParamsAll, strip0x, TxStatus,
    UnmarshalledMintTx,
} from "@renproject/ren-js-common";
import BigNumber from "bignumber.js";
import BN from "bn.js";
import { OrderedMap } from "immutable";
import Web3 from "web3";
import { TransactionConfig, TransactionReceipt } from "web3-core";
import { provider } from "web3-providers";
import { sha3 } from "web3-utils";

import { payloadToShiftInABI } from "./lib/abi";
import { processShiftInParams } from "./lib/processParams";
import { forwardEvents, RenWeb3Events, Web3Events } from "./lib/promievent";
import {
    fixSignature, generateAddress, generateGHash, generatePHash, generateShiftInTxHash,
    getShifterAddress, ignoreError, randomNonce, renTxHashToBase64, retrieveDeposits, SECONDS,
    signatureToString, sleep, toBase64, toBigNumber, UTXO, UTXOInput, withDefaultAccount,
} from "./lib/utils";
import { ResponseQueryMintTx } from "./renVM/jsonRPC";
import { ShifterNetwork, unmarshalMintTx } from "./renVM/shifterNetwork";
import { NetworkDetails } from "./types/networks";

export class ShiftInObject {
    public utxo: UTXOInput | undefined;
    public gatewayAddress: string | undefined;
    private readonly network: NetworkDetails;
    private readonly renVMNetwork: ShifterNetwork;
    private readonly params: ShiftInParamsAll;

    constructor(_renVMNetwork: ShifterNetwork, _network: NetworkDetails, _params: ShiftInParams) {
        this.network = _network;
        this.renVMNetwork = _renVMNetwork;
        this.params = processShiftInParams(this.network, _params);

        const renTxHash = this.params.renTxHash;

        if (!renTxHash) {
            const { sendToken: renContract, contractCalls, nonce: maybeNonce, requiredAmount } = this.params;

            if (requiredAmount && toBigNumber(requiredAmount).lte(10000)) {
                throw new Error(`Required amount (${requiredAmount}) is less than minimum shift amount`);
            }

            if (!contractCalls || !contractCalls.length) {
                throw new Error(`Must provide Ren transaction hash or contract call details.`);
            }

            if (!renContract) {
                throw new Error(`Must provide Ren transaction hash or token to be shifted.`);
            }

            // Last contract call
            const { contractParams, sendTo } = contractCalls[contractCalls.length - 1];

            const nonce = maybeNonce || randomNonce();
            this.params.nonce = nonce;

            // TODO: Validate inputs
            const gHash = generateGHash(contractParams || [], strip0x(sendTo), renContract, nonce, this.network);
            const gatewayAddress = generateAddress(renContract, gHash, this.network);
            this.gatewayAddress = gatewayAddress;
        }
    }

    public addr = () => this.gatewayAddress;

    public waitForDeposit = (confirmations: number): PromiEvent<this, { "deposit": [UTXO] }> => {
        const promiEvent = newPromiEvent<this, { "deposit": [UTXO] }>();

        (async () => {
            // If the deposit has already been submitted, skip "waitForDeposit".
            if (this.params.renTxHash) {
                return this;
            }

            if (!this.gatewayAddress) {
                throw new Error("Unable to calculate gateway address.");
            }

            const { requiredAmount, sendToken: renContract } = this.params;

            if (!renContract) {
                throw new Error(`Must provide token to be shifted.`);
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

            let deposits: OrderedMap<string, UTXO> = OrderedMap();
            // const depositedAmount = (): number => {
            //     return deposits.map(item => item.utxo.value).reduce((prev, next) => prev + next, 0);
            // };

            // tslint:disable-next-line: no-constant-condition
            while (true) {
                if (promiEvent._isCancelled()) {
                    throw new Error("waitForDeposit cancelled.");
                }

                if (deposits.size > 0) {
                    // Sort deposits
                    const greatestTx = deposits.filter(utxo => utxo.utxo.confirmations >= confirmations).sort((a, b) => a.utxo.value > b.utxo.value ? -1 : 1).first<UTXO>(undefined);

                    // Handle required minimum and maximum amount
                    let minimum = new BigNumber(0);
                    let maximum = new BigNumber(Infinity);
                    if (requiredAmount) {
                        if (BigNumber.isBigNumber(requiredAmount) || typeof requiredAmount === "number" || typeof requiredAmount === "string" || BN.isBN(requiredAmount)) {
                            minimum = toBigNumber(requiredAmount);
                        } else {
                            const requiredAmountSpread = requiredAmount as { min: BN | BigNumber | number | string, max: BN | BigNumber | number | string };
                            if (requiredAmountSpread.min) {
                                minimum = toBigNumber(requiredAmountSpread.min);
                            }
                            if (requiredAmountSpread.max) {
                                maximum = toBigNumber(maximum);
                            }
                        }
                    }

                    if (greatestTx && new BigNumber(greatestTx.utxo.value).gte(minimum) && new BigNumber(greatestTx.utxo.value).lte(maximum)) {
                        this.utxo = greatestTx.utxo;
                        break;
                    }
                }

                try {
                    const newDeposits = await retrieveDeposits(this.network, renContract, this.gatewayAddress, 0);

                    let newDeposit = false;
                    for (const deposit of newDeposits) {
                        // tslint:disable-next-line: no-non-null-assertion
                        if (!deposits.has(deposit.utxo.txid) || deposits.get(deposit.utxo.txid)!.utxo.confirmations !== deposit.utxo.confirmations) {
                            promiEvent.emit("deposit", deposit);
                            newDeposit = true;
                        }
                        deposits = deposits.set(deposit.utxo.txid, deposit);
                    }
                    if (newDeposit) { continue; }
                } catch (error) {
                    // tslint:disable-next-line: no-console
                    console.error(String(error));
                    await sleep(1 * SECONDS);
                    continue;
                }
                await sleep(10 * SECONDS);
            }
            return this;
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    public renTxHash = (specifyUTXO?: UTXOInput) => {
        const renTxHash = this.params.renTxHash;
        if (renTxHash) {
            return renTxHashToBase64(renTxHash);
        }

        const { contractCalls, sendToken: renContract, nonce } = this.params;

        const utxo = specifyUTXO || this.utxo;
        if (!utxo) {
            throw new Error(`Unable to generate renTxHash without UTXO. Call 'waitForDeposit' first.`);
        }

        if (!nonce) {
            throw new Error(`Unable to generate renTxHash without nonce.`);
        }

        if (!contractCalls || !contractCalls.length) {
            throw new Error(`Unable to generate renTxHash without contract call details.`);
        }

        if (!renContract) {
            throw new Error(`Unable to generate renTxHash without token being shifted.`);
        }

        // Last contract call
        const { contractParams, sendTo } = contractCalls[contractCalls.length - 1];

        const gHash = generateGHash(contractParams || [], strip0x(sendTo), renContract, nonce, this.network);
        const encodedGHash = toBase64(gHash);
        return generateShiftInTxHash(renContract, encodedGHash, utxo);
    }

    public queryTx = async (specifyUTXO?: UTXOInput) =>
        unmarshalMintTx(await this.renVMNetwork.queryTX(Ox(Buffer.from(this.renTxHash(specifyUTXO), "base64"))))

    public submitToRenVM = (specifyUTXO?: UTXOInput): PromiEvent<Signature, { "renTxHash": [string], "status": [TxStatus] }> => {
        const promiEvent = newPromiEvent<Signature, { "renTxHash": [string], "status": [TxStatus] }>();

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
                    throw new Error(`Unable to submit to RenVM without token being shifted.`);
                }

                // Last contract call
                const { contractParams, sendTo } = contractCalls[contractCalls.length - 1];

                // Try to submit to RenVM. If that fails, see if they already
                // know about the transaction.
                try {
                    renTxHash = await this.renVMNetwork.submitShiftIn(
                        renContract,
                        sendTo,
                        nonce,
                        generatePHash(contractParams || []),
                        utxo.txid,
                        utxo.output_no.toFixed(),
                        this.network,
                    );
                    if (renTxHash !== utxoRenTxHash) {
                        console.warn(`Unexpected txHash returned from RenVM: expected ${utxoRenTxHash} but got ${renTxHash}`);
                    }
                } catch (error) {
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
                throw new Error(`Must call 'waitForDeposit' or provide UTXO or RenVM transaction hash.`);
            }

            const marshalledResponse = await this.renVMNetwork.waitForTX<ResponseQueryMintTx>(
                Ox(Buffer.from(renTxHash, "base64")),
                (status) => {
                    promiEvent.emit("status", status);
                },
                () => promiEvent._isCancelled(),
            );

            const response = unmarshalMintTx(marshalledResponse);

            // tslint:disable-next-line: no-use-before-declare
            return new Signature(this.network, this.params as ShiftInParams, response, renTxHash);
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    // tslint:disable-next-line:no-any
    public waitAndSubmit = async (web3Provider: provider, confirmations: number, txConfig?: TransactionConfig, specifyUTXO?: UTXOInput) => {
        await this.waitForDeposit(confirmations);
        const signature = await this.submitToRenVM(specifyUTXO);
        return signature.submitToEthereum(web3Provider, txConfig);
    }
}

export class Signature {
    public params: ShiftInParamsAll;
    public network: NetworkDetails;
    public response: UnmarshalledMintTx;
    public signature: string;
    public _renTxHash: string;

    constructor(_network: NetworkDetails, _params: ShiftInParams, _response: UnmarshalledMintTx, _renTxHash: string) {
        this.network = _network;
        this.response = _response;
        this._renTxHash = _renTxHash;
        this.params = processShiftInParams(this.network, _params);

        this.signature = signatureToString(fixSignature(this.response, this.network));
    }

    public renTxHash = () => this._renTxHash;

    // tslint:disable-next-line: no-any
    public submitToEthereum = (web3Provider: provider, txConfig?: TransactionConfig): PromiEvent<TransactionReceipt, Web3Events & RenWeb3Events> => {
        // tslint:disable-next-line: no-any
        const promiEvent = newPromiEvent<TransactionReceipt, Web3Events & RenWeb3Events>();

        (async () => {

            const web3 = new Web3(web3Provider);

            const { sendToken: renContract } = this.params;

            // Check if the signature has already been submitted
            if (renContract) {
                try {
                    const shifterAddress = await getShifterAddress(this.network, web3, renContract);
                    const shifter = new web3.eth.Contract(this.network.contracts.addresses.shifter.BTCShifter.abi, shifterAddress);
                    // We can skip the `status` check and call `getPastLogs` directly - for now both are called in case
                    // the contract
                    const status = await shifter.methods.status(this.response.autogen.sighash).call();
                    if (status) {
                        const recentRegistrationEvents = await web3.eth.getPastLogs({
                            address: shifterAddress,
                            fromBlock: "1",
                            toBlock: "latest",
                            // topics: [sha3("LogDarknodeRegistered(address,uint256)"), "0x000000000000000000000000" +
                            // address.slice(2), null, null] as any,
                            topics: [sha3("LogShiftIn(address,uint256,uint256,bytes32)"), null, null, this.response.autogen.sighash] as string[],
                        });
                        if (!recentRegistrationEvents.length) {
                            throw new Error(`Shift has been submitted but no log was found.`);
                        }
                        const log = recentRegistrationEvents[0];
                        const receipt = await web3.eth.getTransactionReceipt(log.transactionHash);
                        promiEvent.emit("transactionHash", log.transactionHash);

                        const emitConfirmation = async () => {
                            const currentBlock = await web3.eth.getBlockNumber();
                            promiEvent.emit("confirmation", Math.max(0, currentBlock - receipt.blockNumber), receipt);
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
                        // const txHash = await new Promise((resolve, reject) => shift.on("transactionHash", resolve).catch(reject));
                        // shift.on("confirmation", () => { /* do something */ });
                        // ```
                        await emitConfirmation();
                        setTimeout(emitConfirmation, 1000);
                        return receipt;
                    }
                } catch (error) {
                    // tslint:disable-next-line: no-console
                    console.error(error);
                    // Continue with transaction
                }
            }

            const { contractCalls } = this.params;

            let tx: PromiEvent<unknown, Web3Events> | undefined;

            for (let i = 0; i < contractCalls.length; i++) {
                const contractCall = contractCalls[i];
                const last = i === contractCalls.length - 1;

                const { contractParams, contractFn, sendTo, txConfig: txConfigParam } = contractCall;

                let params;
                if (last) {
                    params = [
                        ...(contractParams || []).map(value => value.value),
                        Ox(new BigNumber(this.response.in.amount).toString(16)), // _amount: BigNumber
                        Ox(this.response.autogen.nhash),
                        // Ox(this.response.args.n), // _nHash: string
                        Ox(this.signature), // _sig: string
                    ];
                } else {
                    params = (contractParams || []).map(value => value.value);
                }

                const ABI = payloadToShiftInABI(contractFn, (contractParams || []));

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
                    forwardEvents(tx!, promiEvent);
                }

                // tslint:disable-next-line: no-non-null-assertion
                await new Promise((resolve, reject) => tx!
                    .on("transactionHash", resolve)
                    .catch((error: Error) => {
                        // tslint:disable-next-line: no-console
                        try { if (ignoreError(error)) { console.error(String(error)); return; } } catch (_error) { /* Ignore _error */ }
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
                    try { if (ignoreError(error)) { console.error(String(error)); return; } } catch (_error) { /* Ignore _error */ }
                    reject(error);
                })
            );
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        // TODO: Look into why .catch isn't being called on tx
        promiEvent.on("error", (error) => {
            // tslint:disable-next-line: no-console
            try { if (ignoreError(error)) { console.error(String(error)); return; } } catch (_error) { /* Ignore _error */ }
            promiEvent.reject(error);
        });

        return promiEvent;
    }

    /**
     * Alternative to `submitToEthereum` that doesn't need a web3 instance
     */
    public createTransaction = async (txConfig?: TransactionConfig): Promise<TransactionConfig> => {
        const { contractCalls } = this.params;

        if (!contractCalls || contractCalls.length !== 1) {
            throw new Error(`Must provide exactly one contract call to createTransaction.`);
        }

        const contractCall = contractCalls[0];

        const { contractParams, contractFn, sendTo, txConfig: txConfigParam } = contractCall;

        const params = [
            ...(contractParams || []).map(value => value.value),
            Ox(new BigNumber(this.response.in.amount).toString(16)), // _amount: BigNumber
            Ox(this.response.autogen.nhash),
            // Ox(generateNHash(this.response)), // _nHash: string
            Ox(this.signature), // _sig: string
        ];

        const ABI = payloadToShiftInABI(contractFn, (contractParams || []));
        // tslint:disable-next-line: no-any
        const web3: Web3 = new (Web3 as any)();
        const contract = new web3.eth.Contract(ABI);

        const data = contract.methods[contractFn](
            ...params,
        ).encodeABI();

        return await withDefaultAccount(web3, {
            to: sendTo,
            data,

            ...txConfigParam,
            ...{
                value: txConfigParam && txConfigParam.value ? txConfigParam.value.toString() : undefined,
                gasPrice: txConfigParam && txConfigParam.gasPrice ? txConfigParam.gasPrice.toString() : undefined,
            },

            ...txConfig,
        });
    }
}
