import Web3 from "web3";

import { payloadToABI } from "./abi";
import { ShiftAction } from "./assets";
import {
    lightnodes, ShiftedInResponse, ShiftedOutResponse, ShifterGroup,
} from "./darknode/darknodeGroup";
import { generateAddress, hashPayload, Payload, retrieveDeposits, SECONDS, sleep } from "./utils";

export * from "./darknode/darknodeGroup";
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
    private readonly darknodeGroup: ShifterGroup;

    // Takes the address of the adapter smart contract
    constructor() {
        this.darknodeGroup = new ShifterGroup(lightnodes);
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public burn = async (shiftAction: ShiftAction, to: string, valueHex: string): Promise<string> => {
        return /* await */ this.darknodeGroup.submitWithdrawal(shiftAction, to, valueHex);
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public shift = (shiftAction: ShiftAction, to: string, amount: number | string, nonce: string, payload: Payload): Shift => {
        const gatewayAddress = generateAddress(to, shiftAction, amount, payload);
        return {
            addr: () => gatewayAddress,
            wait: this._waitAfterShift(shiftAction, to, amount, nonce, payload, gatewayAddress),
        };
    }

    private readonly _waitAfterShift = (shiftAction: ShiftAction, to: string, amount: number | string, nonce: string, payload: Payload, gatewayAddress: string) =>
        async (confirmations: number): Promise<Wait> => {
            let deposits;
            // TODO: Check value of deposits
            while (!deposits) {
                deposits = await retrieveDeposits(shiftAction, gatewayAddress, 10, confirmations);
                if (deposits) { break; }
                await sleep(10 * SECONDS);
            }

            return {
                submit: this._submitDepositAfterShift(shiftAction, to, amount, nonce, payload, gatewayAddress, deposits),
            };
        }

    // tslint:disable-next-line: no-any (FIXME)
    private readonly _submitDepositAfterShift = (shiftAction: ShiftAction, to: string, amount: number | string, nonce: string, payload: Payload, gatewayAddress: string, deposits: any) =>
        async (): Promise<Submit> => {
            const messageID = await this.darknodeGroup.submitDeposits(shiftAction, to, amount, nonce, hashPayload(payload), nonce); // TODO: Pass hash instead of nonce

            let response: ShiftedInResponse | ShiftedOutResponse | undefined;
            while (!response) {
                try {
                    response = await this.darknodeGroup.checkForResponse(messageID);
                } catch (error) {
                    // TODO: Ignore "result not available",
                    // throw otherwise
                }

                // Break before sleeping if responses is not undefined
                if (response) { break; }
                await sleep(10 * SECONDS);
            }

            // TODO: Use github.com/primus/eventemitter3
            const onMessageID = async () => {
                while (!messageID) {
                    await sleep(1 * SECONDS);
                }

                return messageID;
            };

            return {
                signAndSubmit: this._signAndSubmitAfterShift(shiftAction, to, amount, nonce, payload, gatewayAddress, deposits, response),
                onMessageID,
            };
        }

    // tslint:disable-next-line: no-any (FIXME)
    private readonly _signAndSubmitAfterShift = (shiftAction: ShiftAction, to: string, amount: number | string, nonce: string, payload: Payload, gatewayAddress: string, deposits: any, response: ShiftedInResponse | ShiftedOutResponse) =>
        async (web3: Web3, methodName: string): SignAndSubmit => {
            const signature: ShiftedInResponse = response as ShiftedInResponse;
            // TODO: Check that amount and signature.amount are the same
            amount = `0x${signature.amount}`; // _amount: BigNumber
            const txHash = `0x${signature.txHash}`; // _hash: string
            if (signature.v === "") {
                signature.v = "0";
            }
            const v = ((parseInt(signature.v, 10) + 27) || 27).toString(16);
            const signatureBytes = `0x${signature.r}${signature.s}${v}`;

            const params = [
                ...payload.map(value => value.value),
                amount, // _amount: BigNumber
                txHash, // _hash: string
                signatureBytes, // _sig: string
            ];

            const contract = new web3.eth.Contract(payloadToABI(methodName, payload), to);

            const addresses = await web3.eth.getAccounts();

            return contract.methods.trade(
                ...params,
            ).send({ from: addresses[0] });
        }
}
