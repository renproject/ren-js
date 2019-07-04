import { crypto } from "bitcore-lib";
import { BitcoinUTXO } from "blockchain/btc";
import { ZcashUTXO } from "blockchain/zec";
import { OrderedMap } from "immutable";
import Web3 from "web3";
import { TransactionConfig } from "web3-core";
import { provider } from "web3-providers";

import { Ox, strip0x } from "./blockchain/common";
import { payloadToShiftInABI } from "./lib/abi";
import { forwardEvents, newPromiEvent, PromiEvent } from "./lib/promievent";
import {
    fixSignature, generateAddress, generateHash, generatePHash, ignoreError, retrieveDeposits,
    SECONDS, signatureToString, sleep, UTXO, withDefaultAccount,
} from "./lib/utils";
import { RenVMNetwork, ShiftedInResponse } from "./lightnode/renVMNetwork";
import { NetworkDetails } from "./types/networks";
import { ShiftInParams } from "./types/parameters";

export class ShiftInObject {
    public utxo: BitcoinUTXO | ZcashUTXO | undefined;
    public gatewayAddress: string;
    private readonly network: NetworkDetails;
    private readonly renVMNetwork: RenVMNetwork;
    private readonly params: ShiftInParams;

    constructor(renVMNetwork: RenVMNetwork, network: NetworkDetails, params: ShiftInParams) {
        this.params = params;
        this.network = network;
        this.renVMNetwork = renVMNetwork;

        const { sendToken, contractParams, sendAmount, sendTo } = params;

        if (!this.params.nonce) {
            this.params.nonce = Ox(crypto.Random.getRandomBuffer(32));
        }

        // TODO: Validate inputs
        const hash = generateHash(contractParams, sendAmount, strip0x(sendTo), sendToken, this.params.nonce, network);
        const gatewayAddress = generateAddress(sendToken, hash, network);
        this.gatewayAddress = gatewayAddress;
    }

    public addr = () => this.gatewayAddress;

    public waitForDeposit = (confirmations: number): PromiEvent<this> => {
        const promiEvent = newPromiEvent<this>();

        (async () => {
            let deposits: OrderedMap<string, UTXO> = OrderedMap();
            // const depositedAmount = (): number => {
            //     return deposits.map(item => item.utxo.value).reduce((prev, next) => prev + next, 0);
            // };
            // tslint:disable-next-line: no-constant-condition
            while (true) {
                if (deposits.size > 0) {
                    // Sort deposits
                    const greatestTx = deposits.sort((a, b) => a.utxo.value > b.utxo.value ? -1 : 1).first(undefined);
                    if (greatestTx && greatestTx.utxo.value >= this.params.sendAmount) {
                        this.utxo = greatestTx.utxo;
                        break;
                    }
                }

                try {
                    const newDeposits = await retrieveDeposits(this.network, this.params.sendToken, this.gatewayAddress, confirmations);

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
                    console.error(error);
                    continue;
                }
                await sleep(10 * SECONDS);
            }
            return this;
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    public submitToRenVM = (specifyUTXO?: BitcoinUTXO | ZcashUTXO): PromiEvent<Signature> => {
        const promiEvent = newPromiEvent<Signature>();

        const utxo = specifyUTXO || this.utxo;
        if (!utxo) {
            throw new Error("Unable to submit without UTXO. Call wait() or provide a UTXO as a parameter.");
        }

        const nonce = this.params.nonce;
        if (!nonce) {
            throw new Error("Unable to submitToRenVM without nonce");
        }

        (async () => {
            const messageID = await this.renVMNetwork.submitDeposits(
                this.params.sendToken,
                this.params.sendTo,
                this.params.sendAmount,
                nonce,
                generatePHash(this.params.contractParams),
                utxo.txid,
                utxo.output_no,
                this.network,
            );

            promiEvent.emit("messageID", messageID);

            const response = await this.renVMNetwork.waitForResponse(messageID) as ShiftedInResponse;

            // tslint:disable-next-line: no-use-before-declare
            return new Signature(this.network, this.params, response, messageID);
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
    public response: ShiftedInResponse;
    public signature: string;
    public messageID: string;

    constructor(network: NetworkDetails, params: ShiftInParams, response: ShiftedInResponse, messageID: string) {
        this.params = params;
        this.network = network;
        this.response = response;
        this.messageID = messageID;
        this.signature = signatureToString(fixSignature(response, network));
    }

    // tslint:disable-next-line: no-any
    public submitToEthereum = (web3Provider: provider, txConfig?: TransactionConfig): PromiEvent<any> => {
        // tslint:disable-next-line: no-any
        const promiEvent = newPromiEvent<any>();

        (async () => {
            const params = [
                ...this.params.contractParams.map(value => value.value),
                Ox(this.response.amount.toString(16)), // _amount: BigNumber
                Ox(this.response.nhash), // _nHash: string
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

            return await tx
                .catch((error: Error) => {
                    try { if (ignoreError(error)) { return; } } catch (_error) { /* Ignore _error */ }
                    throw error;
                });
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    /**
     * Alternative to `submitToEthereum` that doesn't need a web3 instance
     */
    public createTransaction = async (txConfig?: TransactionConfig): Promise<TransactionConfig> => {
        const params = [
            ...this.params.contractParams.map(value => value.value),
            Ox(this.response.amount.toString(16)), // _amount: BigNumber
            Ox(this.response.nhash), // _nHash: string
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
