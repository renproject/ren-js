import { OrderedMap } from "immutable";
import Web3 from "web3";
import { TransactionConfig, TransactionReceipt } from "web3-core";
import { provider } from "web3-providers";

import { BitcoinUTXO } from "./blockchain/btc";
import { Ox, strip0x } from "./blockchain/common";
import { ZcashUTXO } from "./blockchain/zec";
import { payloadToShiftInABI } from "./lib/abi";
import { forwardEvents, newPromiEvent, PromiEvent } from "./lib/promievent";
import {
    fixSignature, generateAddress, generateGHash, generatePHash, ignoreError, randomNonce,
    retrieveDeposits, SECONDS, signatureToString, sleep, UTXO, withDefaultAccount,
} from "./lib/utils";
import { ShifterNetwork } from "./renVM/shifterNetwork";
import { Tx } from "./renVM/transaction";
import { NetworkDetails } from "./types/networks";
import { ShiftInFromDetails, ShiftInParams, ShiftInParamsAll } from "./types/parameters";

export class ShiftInObject {
    public utxo: BitcoinUTXO | ZcashUTXO | undefined;
    public gatewayAddress: string | undefined;
    private readonly network: NetworkDetails;
    private readonly renVMNetwork: ShifterNetwork;
    private readonly params: ShiftInParamsAll;

    constructor(renVMNetwork: ShifterNetwork, network: NetworkDetails, params: ShiftInParams) {
        this.params = params;
        this.network = network;
        this.renVMNetwork = renVMNetwork;

        if (!(params as ShiftInParamsAll).messageID) {
            const { sendToken, contractParams, sendAmount, sendTo, nonce: maybeNonce } = params as ShiftInFromDetails;

            const nonce = maybeNonce || randomNonce();
            (this.params as ShiftInFromDetails).nonce = nonce;

            // TODO: Validate inputs
            const gHash = generateGHash(contractParams, sendAmount, strip0x(sendTo), sendToken, nonce, network);
            const gatewayAddress = generateAddress(sendToken, gHash, network);
            this.gatewayAddress = gatewayAddress;
        }
    }

    public addr = () => this.gatewayAddress;

    public waitForDeposit = (confirmations: number): PromiEvent<this> => {
        const promiEvent = newPromiEvent<this>();
        (async () => {
            if (this.params.messageID) {
                return this;
            }

            if (!this.gatewayAddress) {
                throw new Error("Unable to calculate gateway address");
            }

            const { sendAmount, sendToken } = this.params as ShiftInFromDetails;

            let deposits: OrderedMap<string, UTXO> = OrderedMap();
            // const depositedAmount = (): number => {
            //     return deposits.map(item => item.utxo.value).reduce((prev, next) => prev + next, 0);
            // };

            // Every nth time, try a different end-point
            let retryCount = 0;

            // tslint:disable-next-line: no-constant-condition
            while (true) {
                if (deposits.size > 0) {
                    // Sort deposits
                    const greatestTx = deposits.sort((a, b) => a.utxo.value > b.utxo.value ? -1 : 1).first<UTXO>(undefined);
                    if (greatestTx && greatestTx.utxo.value >= sendAmount) {
                        this.utxo = greatestTx.utxo;
                        break;
                    }
                }

                try {
                    const newDeposits = await retrieveDeposits(this.network, sendToken, this.gatewayAddress, confirmations, retryCount);

                    let newDeposit = false;
                    for (const deposit of newDeposits) {
                        if (!deposits.has(deposit.utxo.txid)) {
                            deposits = deposits.set(deposit.utxo.txid, deposit);
                            promiEvent.emit("deposit", deposit.utxo);
                            newDeposit = true;
                        }
                    }
                    if (newDeposit) { continue; }
                } catch (error) {
                    // tslint:disable-next-line: no-console
                    console.error(String(error));
                    await sleep(1 * SECONDS);
                    continue;
                }
                await sleep(10 * SECONDS);
                retryCount++;
            }
            return this;
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    public submitToRenVM = (specifyUTXO?: BitcoinUTXO | ZcashUTXO): PromiEvent<Signature> => {
        const promiEvent = newPromiEvent<Signature>();

        (async () => {
            let messageID = this.params.messageID;

            if (!messageID) {
                const utxo = specifyUTXO || this.utxo;

                if (!utxo) {
                    throw new Error("Unable to submit without UTXO. Call waitForDeposit() or provide a UTXO as a parameter.");
                }

                const { nonce, sendToken, sendTo, sendAmount, contractParams } = this.params as ShiftInFromDetails;

                if (!nonce) {
                    throw new Error("Unable to submitToRenVM without nonce");
                }

                messageID = await this.renVMNetwork.submitShiftIn(
                    sendToken,
                    sendTo,
                    sendAmount,
                    nonce,
                    generatePHash(contractParams),
                    utxo.txid,
                    utxo.output_no,
                    this.network,
                );

                promiEvent.emit("messageID", messageID);
            }

            const response = await this.renVMNetwork.queryShiftIn(messageID, (status) => {
                promiEvent.emit("status", status);
            });

            // tslint:disable-next-line: no-use-before-declare
            return new Signature(this.network, this.params as ShiftInParams, response, messageID);
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    // tslint:disable-next-line:no-any
    public waitAndSubmit = async (web3Provider: provider, confirmations: number, txConfig?: TransactionConfig, specifyUTXO?: BitcoinUTXO | ZcashUTXO) => {
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
    public messageID: string;

    constructor(network: NetworkDetails, params: ShiftInParams, response: Tx, messageID: string) {
        this.params = params;
        this.network = network;
        this.response = response;
        this.messageID = messageID;
        this.signature = signatureToString(fixSignature(response, network));
    }

    // tslint:disable-next-line: no-any
    public submitToEthereum = (web3Provider: provider, txConfig?: TransactionConfig): PromiEvent<TransactionReceipt> => {
        // tslint:disable-next-line: no-any
        const promiEvent = newPromiEvent<TransactionReceipt>();

        (async () => {
            const params = [
                ...this.params.contractParams.map(value => value.value),
                Ox(this.response.args.amount.toString(16)), // _amount: BigNumber
                Ox(this.response.args.nhash),
                // Ox(this.response.args.n), // _nHash: string
                Ox(this.signature), // _sig: string
            ];

            const ABI = payloadToShiftInABI(this.params.contractFn, this.params.contractParams);
            const web3 = new Web3(web3Provider);
            const contract = new web3.eth.Contract(ABI, this.params.sendTo);

            const tx = contract.methods[this.params.contractFn](
                ...params,
            ).send(await withDefaultAccount(web3, {
                ...this.params.txConfig,
                ...txConfig,
            }));

            forwardEvents(tx, promiEvent);

            return await new Promise<TransactionReceipt>((resolve, reject) => tx
                .once("confirmation", (_confirmations: number, receipt: TransactionReceipt) => { resolve(receipt); })
                .catch((error: Error) => {
                    try { if (ignoreError(error)) { console.error(String(error)); return; } } catch (_error) { /* Ignore _error */ }
                    reject(error);
                })
            );
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        // TODO: Look into why .catch isn't being called on tx
        promiEvent.on("error", (error) => {
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
