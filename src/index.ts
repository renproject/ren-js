import { crypto } from "bitcore-lib";
import { OrderedMap } from "immutable";
import Web3 from "web3";
import { PromiEvent as Web3PromiEvent } from "web3-core";
import { keccak256 } from "web3-utils";

import { payloadToShiftInABI } from "./abi";
import { Token } from "./assets";
import { Ox, strip0x } from "./blockchain/common";
import { ShiftedInResponse, ShiftedOutResponse, Shifter } from "./lightnode/shifter";
import { Network } from "./networks";
import { newPromiEvent, PromiEvent } from "./promievent";
import {
    fixSignature, generateAddress, generateHash, generatePHash, Payload, retrieveDeposits, SECONDS,
    signatureToString, sleep, UTXO,
} from "./utils";

export * from "./lightnode/shifter";
export * from "./blockchain/btc";
export * from "./blockchain/zec";
export * from "./blockchain/common";
export * from "./assets";
export * from "./networks";

export { UTXO } from "./utils";

interface ShiftParams {
    /**
     * The token, including the origin and destination chains
     */
    sendToken: Token;

    /**
     * The receiving address, in a format matching that of the destination
     * chain
     */
    sendTo: string;

    /**
     * The amount of `sendToken` to be sent
     */
    sendAmount: number;

    /**
     * The name of the function to be called on the Adapter contract
     */
    contractFn: string;

    /**
     * The parameters to be passed to the Adapter contract
     */
    contractParams: Payload;

    /**
     * An option to override the default nonce generated randomly.
     */
    nonce?: string;
}

interface BurnParams {
    web3: Web3;
    sendToken: Token;
    txHash: string;
}

interface ShiftDetails {
    shifter: Shifter;
    network: Network;

    shiftAction: Token;
    to: string;
    amount: number;
    nonce: string;
    contractFn: string;
    contractParams: Payload;
    gatewayAddress: string;
    hash: string;
}

export class Signature {
    public shiftDetails: ShiftDetails;
    public response: ShiftedInResponse;
    public signature: string;
    public messageID: string;

    constructor(shiftDetails: ShiftDetails, response: ShiftedInResponse, messageID: string) {
        this.shiftDetails = shiftDetails;
        this.response = response;
        this.messageID = messageID;
        this.signature = signatureToString(fixSignature(response, this.shiftDetails.network));
    }

    public signAndSubmit = (web3: Web3, from: string) => {
        const params = [
            ...this.shiftDetails.contractParams.map(value => value.value),
            Ox(this.response.amount.toString(16)), // _amount: BigNumber
            Ox(this.response.nhash), // _nHash: string
            Ox(this.signature), // _sig: string
        ];

        const ABI = payloadToShiftInABI(this.shiftDetails.contractFn, this.shiftDetails.contractParams);
        const contract = new web3.eth.Contract(ABI, this.shiftDetails.to);

        return contract.methods[this.shiftDetails.contractFn](
            ...params,
        ).send({ from, gas: 1000000 });
    }
}

export class DepositGroup {
    public shiftDetails: ShiftDetails;

    constructor(shiftDetails: ShiftDetails) {
        this.shiftDetails = shiftDetails;
    }

    public submit = (): PromiEvent<Signature> => {
        const promiEvent = newPromiEvent<Signature>();

        (async () => {
            const messageID = await this.shiftDetails.shifter.submitDeposits(
                this.shiftDetails.shiftAction,
                this.shiftDetails.to,
                this.shiftDetails.amount,
                this.shiftDetails.nonce,
                generatePHash(this.shiftDetails.contractParams),
                this.shiftDetails.hash,
                this.shiftDetails.network,
            );

            promiEvent.emit("messageID", messageID);

            const response = await this.shiftDetails.shifter.checkForResponse(messageID) as ShiftedInResponse;

            promiEvent.resolve(new Signature(this.shiftDetails, response, messageID));
        })().catch(promiEvent.reject);

        return promiEvent;
    }
}

export class ShiftObject {
    public shiftDetails: ShiftDetails;

    constructor(shiftDetails: ShiftDetails) {
        this.shiftDetails = shiftDetails;
    }

    public addr = () => this.shiftDetails.gatewayAddress;

    public wait = (confirmations: number): PromiEvent<DepositGroup> => {
        const promiEvent = newPromiEvent<DepositGroup>();

        (async () => {
            let deposits: OrderedMap<string, UTXO> = OrderedMap();
            const depositedAmount = (): number => {
                return deposits.map(item => item.utxo.amount).reduce((prev, next) => prev + next, 0);
            };
            // tslint:disable-next-line: no-constant-condition
            while (true) {
                if (!(deposits.size === 0 || depositedAmount() < this.shiftDetails.amount)) {
                    break;
                }
                try {
                    const newDeposits = await retrieveDeposits(this.shiftDetails.shiftAction, this.shiftDetails.gatewayAddress, 10, confirmations);
                    let newDeposit = false;
                    for (const deposit of newDeposits) {
                        if (!deposits.has(deposit.utxo.txHash)) {
                            deposits = deposits.set(deposit.utxo.txHash, deposit);
                            promiEvent.emit("deposit", deposit.utxo);
                            newDeposit = true;
                        }
                    }
                    if (newDeposit) { continue; }
                } catch (error) {
                    console.error(error);
                    continue;
                }
                await sleep(10 * SECONDS);
            }
            promiEvent.resolve(new DepositGroup(this.shiftDetails));
        })().catch(promiEvent.reject);

        return promiEvent;
    }

    // tslint:disable-next-line:no-any
    public waitAndSubmit = async (web3: Web3, from: string, confirmations: number): Promise<Web3PromiEvent<any>> => {
        const deposit = await this.wait(confirmations);
        const signature = await deposit.submit();
        return signature.signAndSubmit(web3, from);
    }
}

export default class RenSDK {
    // Internal state
    private readonly network: Network;
    private readonly shifter: Shifter;

    // Takes the address of the adapter smart contract
    constructor(network: Network) {
        this.network = network;
        this.shifter = new Shifter(network.lightnodeURL);
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public burnDetails = async (params: BurnParams): Promise<ShiftedOutResponse> => {
        const { web3, sendToken, txHash } = params;

        const receipt = await web3.eth.getTransactionReceipt(txHash);
        if (!receipt.logs) {
            throw Error("No events found in transaction");
        }

        // Currently should equal 0x2275318eaeb892d338c6737eebf5f31747c1eab22b63ccbc00cd93d4e785c116
        const burnTopic = keccak256("LogShiftOut(bytes,uint256,uint256,bytes)");

        let ref;
        for (const [, event] of Object.entries(receipt.logs)) {
            if (event.topics[0] === burnTopic) {
                ref = event.topics[1] as string;
                break;
            }
        }

        if (!ref) {
            throw Error("No reference ID found in logs");
        }

        const messageID = await this.shifter.submitWithdrawal(sendToken, ref);
        const response = await this.shifter.checkForResponse(messageID) as ShiftedOutResponse;

        return response;
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public shift = (params: ShiftParams): ShiftObject => {
        const { sendToken, contractFn, contractParams, sendAmount, sendTo } = params;
        let { nonce } = params;

        if (!nonce) {
            nonce = Ox(crypto.Random.getRandomBuffer(32));
        }

        // TODO: Validate inputs
        const hash = generateHash(contractParams, sendAmount, strip0x(sendTo), sendToken, nonce, this.network);
        const gatewayAddress = generateAddress(sendToken, hash, this.network);
        return new ShiftObject({
            shifter: this.shifter,
            network: this.network,
            shiftAction: sendToken,
            to: strip0x(sendTo),
            amount: sendAmount,
            nonce,
            contractFn,
            contractParams,
            gatewayAddress,
            hash,
        });
    }
}
