import Web3 from "web3";

import { payloadToABI } from "./abi";
import { ShiftAction } from "./assets";
import { Ox, strip0x } from "./blockchain/common";
import { lightnode, ShiftedInResponse, ShiftedOutResponse, Shifter } from "./darknode/shifter";
import {
    generateAddress, generateHash, generatePHash, Payload, retrieveDeposits, SECONDS, sleep, UTXO,
} from "./utils";

export * from "./darknode/shifter";
export * from "./blockchain/btc";
export * from "./blockchain/zec";
export * from "./blockchain/common";
export * from "./assets";

export { UTXO } from "./utils";

// Types of RenSDK's methods ///////////////////////////////////////////////////
export type SignAndSubmit = Promise<void>;
export interface Submit {
    signAndSubmit: (web3: Web3, methodName: string) => SignAndSubmit;
    onMessageID: () => Promise<string>;
}
export interface Wait { submit: () => Promise<Submit>; }
export interface Shift {
    addr: () => string;
    wait: (confirmations: number) => Promise<Wait>;
}

export default class RenSDK {

    // Internal state
    private readonly shifter: Shifter;

    // Takes the address of the adapter smart contract
    constructor() {
        this.shifter = new Shifter(lightnode);
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public burn = async (shiftAction: ShiftAction, to: string, amount: number): Promise<string> => {
        return this.shifter.submitWithdrawal(shiftAction, to, amount);
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public shift = (shiftAction: ShiftAction, to: string, amount: number, nonce: string, payload: Payload): Shift => {
        const hash = generateHash(to, shiftAction, amount, payload);
        const gatewayAddress = generateAddress(shiftAction, hash);
        return {
            addr: () => gatewayAddress,
            wait: this._waitAfterShift(shiftAction, to, amount, nonce, payload, gatewayAddress, hash),
        };
    }

    private readonly _waitAfterShift = (shiftAction: ShiftAction, to: string, amount: number, nonce: string, payload: Payload, gatewayAddress: string, hash: string) =>
        async (confirmations: number): Promise<Wait> => {
            let deposits: UTXO[] = [];
            const depositedAmount = (): number => {
                return deposits.map(item => item.utxo.amount).reduce((prev, next) => prev + next);
            };
            while (deposits.length === 0 || depositedAmount() < amount) {
                try {
                    deposits = await retrieveDeposits(shiftAction, gatewayAddress, 10, confirmations);
                } catch (error) {
                    console.error(error);
                    continue;
                }
                if (deposits.length > 0) { break; }
                await sleep(10 * SECONDS);
            }

            return {
                submit: this._submitDepositAfterShift(shiftAction, to, amount, nonce, payload, hash),
            };
        }

    // tslint:disable-next-line: no-any (FIXME)
    private readonly _submitDepositAfterShift = (shiftAction: ShiftAction, to: string, amount: number, nonce: string, payload: Payload, hash: string) =>
        async (): Promise<Submit> => {
            const messageID = await this.shifter.submitDeposits(shiftAction, to, amount, nonce, generatePHash(payload), hash);

            let response: ShiftedInResponse | ShiftedOutResponse | undefined;
            while (!response) {
                try {
                    response = await this.shifter.checkForResponse(messageID);
                    if (response) {
                        console.log("Response from Lightnode:");
                        console.log(response);
                        break;
                    }
                } catch (error) {
                    console.log("Retrying in 10 seconds");
                    await sleep(10 * SECONDS);
                    // TODO: Ignore "result not available",
                    // throw otherwise
                }
            }

            // TODO: Use github.com/primus/eventemitter3
            const onMessageID = async () => {
                while (!messageID) {
                    await sleep(1 * SECONDS);
                }

                return messageID;
            };

            return {
                signAndSubmit: this._signAndSubmitAfterShift(shiftAction, to, payload, response),
                onMessageID,
            };
        }

    // tslint:disable-next-line: no-any (FIXME)
    private readonly _signAndSubmitAfterShift = (shiftAction: ShiftAction, to: string, payload: Payload, response: ShiftedInResponse | ShiftedOutResponse) =>
        async (web3: Web3, methodName: string): SignAndSubmit => {
            const signature: ShiftedInResponse = response as ShiftedInResponse;
            // TODO: Check that amount and signature.amount are the same
            const amount = Ox(signature.amount.toString(16)); // _amount: BigNumber
            const txHash = Ox(strip0x(signature.hash)); // _hash: string
            if (signature.v === "") {
                signature.v = "0";
            }
            const v = ((parseInt(signature.v, 10) + 27) || 27).toString(16);
            const signatureBytes = Ox(`${strip0x(signature.r)}${strip0x(signature.s)}${v}`);

            const params = [
                amount, // _amount: BigNumber
                txHash, // _hash: string
                signatureBytes, // _sig: string
                ...payload.map(value => value.value),
            ];

            console.log(params);

            const contract = new web3.eth.Contract(payloadToABI(methodName, payload), to);

            const addresses = await web3.eth.getAccounts();

            return contract.methods[methodName](
                ...params,
            ).send({ from: addresses[0] });
        }
}
