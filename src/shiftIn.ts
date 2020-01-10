import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import Web3 from "web3";
import { TransactionConfig, TransactionReceipt } from "web3-core";
import { provider } from "web3-providers";
import { sha3 } from "web3-utils";

import { BitcoinCashUTXO } from "./blockchain/bch";
import { BitcoinUTXO } from "./blockchain/btc";
import { ZcashUTXO } from "./blockchain/zec";
import { payloadToShiftInABI } from "./lib/abi";
import { forwardEvents, newPromiEvent, PromiEvent } from "./lib/promievent";
import {
    fixSignature, generateAddress, generateGHash, generatePHash, generateTxHash, ignoreError, Ox,
    randomNonce, retrieveDeposits, SECONDS, signatureToString, sleep, strip0x, UTXO,
    withDefaultAccount,
} from "./lib/utils";
import { ShifterNetwork, unmarshalTx } from "./renVM/shifterNetwork";
import { QueryTxResponse, Tx, TxStatus } from "./renVM/transaction";
import { parseRenContract } from "./types/assets";
import { NetworkDetails } from "./types/networks";
import {
    ShiftInFromDetails, ShiftInFromRenTxHash, ShiftInParams, ShiftInParamsAll,
} from "./types/parameters";

export class ShiftInObject {
    public utxo: BitcoinUTXO | ZcashUTXO | BitcoinCashUTXO | undefined;
    public gatewayAddress: string | undefined;
    private readonly network: NetworkDetails;
    private readonly renVMNetwork: ShifterNetwork;
    private readonly params: ShiftInParamsAll;

    constructor(renVMNetwork: ShifterNetwork, network: NetworkDetails, params: ShiftInParams) {
        this.params = params;
        this.network = network;
        this.renVMNetwork = renVMNetwork;

        const renTxHash = (params as ShiftInParamsAll).renTxHash || (params as ShiftInParamsAll).messageID;

        if (!renTxHash) {
            const { sendToken: renContract, contractParams, sendTo, sendAmount, nonce: maybeNonce } = params as ShiftInFromDetails;

            const nonce = maybeNonce || randomNonce();
            (this.params as ShiftInFromDetails).nonce = nonce;

            // const sendAmountString = BigNumber.isBigNumber(sendAmount) ? sendAmount.toFixed() : new BigNumber(sendAmount.toString()).toFixed();
            const sendAmountNumber = BigNumber.isBigNumber(sendAmount) ? sendAmount.toNumber() : new BigNumber(sendAmount.toString()).toNumber();

            // TODO: Validate inputs
            const gHash = generateGHash(contractParams, sendAmountNumber, strip0x(sendTo), renContract, nonce, network);
            const gatewayAddress = generateAddress(renContract, gHash, network);
            this.gatewayAddress = gatewayAddress;
        }
    }

    public addr = () => this.gatewayAddress;

    public waitForDeposit = (confirmations: number): PromiEvent<this> => {
        const promiEvent = newPromiEvent<this>();
        (async () => {
            if (this.params.renTxHash || this.params.messageID) {
                return this;
            }

            if (!this.gatewayAddress) {
                throw new Error("Unable to calculate gateway address");
            }

            const { sendAmount, sendToken: renContract } = this.params as ShiftInFromDetails;

            try {
                // Check if the darknodes have already seen the transaction
                const queryTxResponse = await this.queryTx();
                if (
                    queryTxResponse.txStatus === TxStatus.TxStatusDone ||
                    queryTxResponse.txStatus === TxStatus.TxStatusExecuting ||
                    queryTxResponse.txStatus === TxStatus.TxStatusPending
                ) {
                    // Shift has already been submitted to RenVM - no need to
                    // wait for deposit.
                    return this;
                }
            } catch (error) {
                // Ignore error
            }

            let deposits: OrderedMap<string, UTXO> = OrderedMap();
            // const depositedAmount = (): number => {
            //     return deposits.map(item => item.utxo.value).reduce((prev, next) => prev + next, 0);
            // };

            // tslint:disable-next-line: no-constant-condition
            while (true) {
                if (deposits.size > 0) {
                    // Sort deposits
                    const greatestTx = deposits.filter(utxo => utxo.utxo.confirmations >= confirmations).sort((a, b) => a.utxo.value > b.utxo.value ? -1 : 1).first<UTXO>(undefined);
                    if (greatestTx && greatestTx.utxo.value >= sendAmount) {
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

    public renTxHash = () => {
        if ((this.params as ShiftInFromRenTxHash).renTxHash) {
            return (this.params as ShiftInFromRenTxHash).renTxHash;
        }

        const { contractParams, sendAmount, sendToken: renContract, nonce, sendTo } = this.params as ShiftInFromDetails;

        if (!nonce) {
            throw new Error(`Unable to generate renTxHash without nonce`);
        }

        const sendAmountNumber = BigNumber.isBigNumber(sendAmount) ? sendAmount.toNumber() : new BigNumber(sendAmount.toString()).toNumber();
        const gHash = generateGHash(contractParams, sendAmountNumber, strip0x(sendTo), renContract, nonce, this.network);
        const encodedGHash = Buffer.from(strip0x(gHash), "hex").toString("base64");
        return generateTxHash(renContract, encodedGHash);
    }

    public queryTx = async () => this.renVMNetwork.queryTX<QueryTxResponse>(this.renTxHash());

    public submitToRenVM = (specifyUTXO?: BitcoinUTXO | ZcashUTXO | BitcoinCashUTXO): PromiEvent<Signature> => {
        const promiEvent = newPromiEvent<Signature>();

        (async () => {
            let renTxHash = this.params.renTxHash || this.params.messageID || this.renTxHash();

            const utxo = specifyUTXO || this.utxo;
            if (utxo) {

                const { nonce, sendToken, sendTo, sendAmount, contractParams } = this.params as ShiftInFromDetails;

                if (!nonce) {
                    throw new Error("Unable to submitToRenVM without nonce");
                }

                const sendAmountNumber = BigNumber.isBigNumber(sendAmount) ? sendAmount.toNumber() : new BigNumber(sendAmount.toString()).toNumber();

                // Try to submit to RenVM. If that fails, see if they already
                // know about the transaction.
                try {
                    renTxHash = await this.renVMNetwork.submitShiftIn(
                        sendToken,
                        sendTo,
                        sendAmountNumber,
                        nonce,
                        generatePHash(contractParams),
                        utxo.txid,
                        utxo.output_no,
                        this.network,
                    );
                } catch (error) {
                    renTxHash = this.renTxHash();

                    try {
                        // Check if the darknodes have already seen the transaction
                        const queryTxResponse = await this.queryTx();
                        if (queryTxResponse.txStatus === TxStatus.TxStatusNil) {
                            throw new Error(`Transaction ${renTxHash} has not been submitted previously.`);
                        }
                    } catch (errorInner) {
                        // Ignore errorInner.
                        throw error;
                    }
                }

                promiEvent.emit("messageID", renTxHash);
                promiEvent.emit("renTxHash", renTxHash);
            }

            const marshalledResponse = await this.renVMNetwork.waitForTX<QueryTxResponse>(renTxHash, (status) => {
                promiEvent.emit("status", status);
            });

            const response = unmarshalTx(marshalledResponse);

            // tslint:disable-next-line: no-use-before-declare
            return new Signature(this.network, this.params as ShiftInParams, response, renTxHash);
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    // tslint:disable-next-line:no-any
    public waitAndSubmit = async (web3Provider: provider, confirmations: number, txConfig?: TransactionConfig, specifyUTXO?: BitcoinUTXO | ZcashUTXO | BitcoinCashUTXO) => {
        await this.waitForDeposit(confirmations);
        const signature = await this.submitToRenVM(specifyUTXO);
        return signature.submitToEthereum(web3Provider, txConfig);
    }
}

export class Signature {
    public params: ShiftInParams;
    public network: NetworkDetails;
    public response: Tx;
    public signature: string;
    public renTxHash: string;
    // Here to maintain backwards compatibility
    public messageID: string;

    constructor(network: NetworkDetails, params: ShiftInParams, response: Tx, renTxHash: string) {
        this.params = params;
        this.network = network;
        this.response = response;
        this.renTxHash = renTxHash;
        this.messageID = renTxHash;
        this.signature = signatureToString(fixSignature(response, network));
    }

    // tslint:disable-next-line: no-any
    public submitToEthereum = (web3Provider: provider, txConfig?: TransactionConfig): PromiEvent<TransactionReceipt> => {
        // tslint:disable-next-line: no-any
        const promiEvent = newPromiEvent<TransactionReceipt>();

        (async () => {

            const web3 = new Web3(web3Provider);

            const { sendToken: renContract } = this.params as ShiftInFromDetails;

            // Check if the signature has already been submitted
            if (renContract) {
                try {
                    const shifterRegistry = new web3.eth.Contract(this.network.contracts.addresses.shifter.ShifterRegistry.abi, this.network.contracts.addresses.shifter.ShifterRegistry.address);
                    const token = parseRenContract(renContract).asset;
                    const shifterAddress = await shifterRegistry.methods.getShifterBySymbol(`z${token}`).call();
                    const shifter = new web3.eth.Contract(this.network.contracts.addresses.shifter.BTCShifter.abi, shifterAddress);
                    // We can skip the `status` check and call `getPastLogs` directly - for now both are called in case
                    // the contract
                    const status = await shifter.methods.status(this.response.args.hash).call();
                    if (status) {
                        const recentRegistrationEvents = await web3.eth.getPastLogs({
                            address: shifterAddress,
                            fromBlock: "1",
                            toBlock: "latest",
                            // topics: [sha3("LogDarknodeRegistered(address,uint256)"), "0x000000000000000000000000" +
                            // address.slice(2), null, null] as any,
                            topics: [sha3("LogShiftIn(address,uint256,uint256,bytes32)"), null, null, this.response.args.hash] as string[],
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

            const params = [
                ...this.params.contractParams.map(value => value.value),
                Ox(this.response.args.amount.toString(16)), // _amount: BigNumber
                Ox(this.response.args.nhash),
                // Ox(this.response.args.n), // _nHash: string
                Ox(this.signature), // _sig: string
            ];

            const ABI = payloadToShiftInABI(this.params.contractFn, this.params.contractParams);

            const contract = new web3.eth.Contract(ABI, this.params.sendTo);

            const tx = contract.methods[this.params.contractFn](
                ...params,
            ).send(await withDefaultAccount(web3, {
                ...this.params.txConfig,
                ...txConfig,
            }));

            forwardEvents(tx, promiEvent);

            return await new Promise<TransactionReceipt>((innerResolve, reject) => tx
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
        const params = [
            ...this.params.contractParams.map(value => value.value),
            Ox(this.response.args.amount.toString(16)), // _amount: BigNumber
            Ox(this.response.args.nhash),
            // Ox(generateNHash(this.response)), // _nHash: string
            Ox(this.signature), // _sig: string
        ];

        const ABI = payloadToShiftInABI(this.params.contractFn, this.params.contractParams);
        // tslint:disable-next-line: no-any
        const web3 = new (Web3 as any)() as Web3;
        const contract = new web3.eth.Contract(ABI);

        const data = contract.methods[this.params.contractFn](
            ...params,
        ).encodeABI();

        return await withDefaultAccount(web3, {
            to: this.params.sendTo,
            data,
            ...this.params.txConfig,
            ...txConfig,
        });
    }
}
