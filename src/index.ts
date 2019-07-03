// tslint:disable: no-use-before-declare

import { crypto } from "bitcore-lib";
import { BitcoinUTXO } from "blockchain/btc";
import { ZcashUTXO } from "blockchain/zec";
import { OrderedMap } from "immutable";
import Web3 from "web3";
import { PromiEvent as Web3PromiEvent } from "web3-core";
import { provider } from "web3-providers";

import { Ox, strip0x } from "./blockchain/common";
import { payloadToABI, payloadToShiftInABI } from "./lib/abi";
import { newPromiEvent, PromiEvent } from "./lib/promievent";
import {
    BURN_TOPIC, fixSignature, generateAddress, generateHash, generatePHash, ignoreError,
    retrieveDeposits, SECONDS, signatureToString, sleep, UTXO,
} from "./lib/utils";
import { RenVMNetwork, ShiftedInResponse, ShiftedOutResponse } from "./lightnode/renVMNetwork";
import { Chain, Token, Tokens } from "./types/assets";
import {
    Network, NetworkDetails, NetworkDevnet, NetworkMainnet, NetworkTestnet,
} from "./types/networks";
import { ShiftInParams, ShiftOutParams, ShiftOutParamsAll } from "./types/parameters";

export * from "./lightnode/renVMNetwork";
export * from "./blockchain/btc";
export * from "./blockchain/zec";
export * from "./blockchain/common";
export * from "./types/assets";
export * from "./types/networks";
export * from "./types/parameters";

export { UTXO } from "./lib/utils";

export default class RenSDK {
    // Expose constants so they can be accessed on the RenSDK class
    // e.g. `RenSDK.Tokens`
    public static Tokens = Tokens;
    public static Networks = Network;
    public static Chains = Chain;

    // Expose constants again without `static` so they can be accessed on
    // instances - e.g. `(new RenSDK()).Tokens`
    public Tokens = Tokens;
    public Networks = Network;
    public Chains = Chain;

    // Internal state
    private readonly network: NetworkDetails;
    private readonly renVMNetwork: RenVMNetwork;

    // Takes a Network object that contains relevant addresses
    constructor(network?: NetworkDetails | string | null | undefined) {
        if (typeof network === "string") {
            switch (network.toLowerCase()) {
                case "":
                case "mainnet":
                    this.network = NetworkMainnet;
                    break;
                case "testnet":
                    this.network = NetworkTestnet;
                    break;
                case "devnet":
                    this.network = NetworkDevnet;
                    break;
                default:
                    throw new Error(`Unsupported network "${network}"`);
            }
        } else if (network === undefined || network === null) {
            this.network = NetworkMainnet;
        } else {
            this.network = network;
        }
        this.renVMNetwork = new RenVMNetwork(this.network.lightnodeURL);
    }

    // Submits the commitment and transaction to the Darknodes, and then submits
    // the signature to the adapter address
    public shiftIn = (params: ShiftInParams): ShiftInObject => {
        return new ShiftInObject(this.renVMNetwork, this.network, params);
    }

    // Submits the commitment and transaction to the Darknodes, and then submits
    // the signature to the adapter address
    public shiftOut = (params: ShiftOutParams): PromiEvent<ShiftOutObject> => {

        const promiEvent = newPromiEvent<ShiftOutObject>();

        (async () => {

            const { transactionConfig, sendToken, web3Provider, contractFn, contractParams, sendTo, from } = params as ShiftOutParamsAll;
            let { burnReference, txHash } = params as ShiftOutParamsAll;

            // There are three parameter configs:
            // Situation (1): A `burnReference` is provided
            // Situation (2): Contract call details are provided
            // Situation (3): A txHash is provided

            // For (1), we don't have to do anything.
            if (!burnReference) {

                if (!web3Provider) {
                    throw new Error("Must provide burn reference ID or web3 provider");
                }

                const web3 = new Web3(web3Provider);

                // Handle situation (2)
                // Make a call to the provided contract and Pass on the
                // transaction hash.
                if (contractParams && contractFn && sendTo && from) {

                    const callParams = [
                        ...contractParams.map(value => value.value),
                    ];

                    const ABI = payloadToABI(contractFn, contractParams);
                    const contract = new web3.eth.Contract(ABI, sendTo);

                    txHash = await new Promise((resolve, reject) =>
                        contract.methods[contractFn](
                            ...callParams,
                        ).send({
                            from,
                            ...transactionConfig,
                        })
                            .on("transactionHash", resolve)
                            .catch((error: Error) => {
                                try { if (ignoreError(error)) { return; } } catch (_error) { /* Ignore _error */ }
                                reject(error);
                            })
                    );
                }

                if (!txHash) {
                    throw new Error("Must provide txHash or contract call details");
                }

                // Handle (3) and continue handling (2)
                // Given a transaction hash, look through the receipts for a
                // ShiftOut event.
                // @dev WARNING: If multiple shiftOuts are present, ShiftOut
                // should be called for each one, passing in the reference IDs.
                let receipt;
                while (!receipt) {
                    receipt = await web3.eth.getTransactionReceipt(txHash);
                }
                if (!receipt.logs) {
                    throw Error("No events found in transaction");
                }

                for (const [, event] of Object.entries(receipt.logs)) {
                    if (event.topics[0] === BURN_TOPIC) {
                        burnReference = event.topics[1] as string;
                        break;
                    }
                }

                if (!burnReference) {
                    throw Error("No reference ID found in logs");
                }
            }

            return new ShiftOutObject(this.renVMNetwork, sendToken, burnReference);

        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }
}

export class ShiftOutObject {
    private readonly renVMNetwork: RenVMNetwork;
    private readonly sendToken: Token;
    private readonly burnReference: string;

    constructor(renVMNetwork: RenVMNetwork, sendToken: Token, burnReference: string) {
        this.renVMNetwork = renVMNetwork;
        this.sendToken = sendToken;
        this.burnReference = burnReference;
    }

    public submitToRenVM = () => {
        const promiEvent = newPromiEvent<ShiftedOutResponse>();

        (async () => {
            const messageID = await this.renVMNetwork.submitWithdrawal(this.sendToken, this.burnReference);
            promiEvent.emit("messageID", messageID);

            return await this.renVMNetwork.waitForResponse(messageID) as ShiftedOutResponse;
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }
}

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

            return new Signature(this.network, this.params, response, messageID);
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }

    // tslint:disable-next-line:no-any
    public waitAndSubmit = async (web3Provider: provider, from: string, confirmations: number): Promise<Web3PromiEvent<any>> => {
        await this.waitForDeposit(confirmations);
        const signature = await this.submitToRenVM();
        return signature.submitToEthereum(web3Provider, from);
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

    public createTransaction = () => {
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

        return {
            to: this.params.sendTo,
            data,
            value: 0,
        };
    }

    public submitToEthereum = (web3Provider: provider, from: string) => {
        const params = [
            ...this.params.contractParams.map(value => value.value),
            Ox(this.response.amount.toString(16)), // _amount: BigNumber
            Ox(this.response.nhash), // _nHash: string
            Ox(this.signature), // _sig: string
        ];

        const ABI = payloadToShiftInABI(this.params.contractFn, this.params.contractParams);
        const web3 = new Web3(web3Provider);
        const contract = new web3.eth.Contract(ABI, this.params.sendTo);

        return contract.methods[this.params.contractFn](
            ...params,
        ).send({
            from,
            ...this.params.transactionConfig,
        })
            .catch((error: Error) => {
                try { if (ignoreError(error)) { return; } } catch (_error) { /* Ignore _error */ }
                throw error;
            });
    }
}
