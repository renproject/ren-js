import Web3 from "web3";
import { AbiItem, soliditySha3 } from "web3-utils";

import { actionToDetails, Asset, Chain, ShiftAction } from "./assets";
import { BitcoinUTXO, createBTCTestnetAddress, getBTCTestnetUTXOs } from "./blockchain/btc";
import { createZECTestnetAddress, getZECTestnetUTXOs, ZcashUTXO } from "./blockchain/zec";
import {
    lightnodes, ShiftedInResponse, ShiftedOutResponse, ShifterGroup,
} from "./darknode/darknodeGroup";

export type UTXO = { chain: Chain.Bitcoin, utxo: BitcoinUTXO } | { chain: Chain.ZCash, utxo: ZcashUTXO };

export * from "./darknode/darknodeGroup";
export * from "./blockchain/btc";
export * from "./blockchain/zec";
export * from "./blockchain/common";
export * from "./assets";

export interface Param {
    type: string;
    // tslint:disable-next-line: no-any
    value: any;
}

const shiftInABITemplate: AbiItem = {
    "constant": false,
    "inputs": [
        {
            "name": "_amount",
            "type": "uint256"
        },
        {
            "name": "_nHash",
            "type": "bytes32"
        },
        {
            "name": "_sig",
            "type": "bytes"
        },
    ],
    "name": "shiftIn",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
};

export type Payload = Param[];

// tslint:disable-next-line: no-any
const hashPayload = (...zip: Param[] | [Param[]]): string => {
    // You can annotate values passed in to soliditySha3.
    // Example: { type: "address", value: srcToken }
    // const zip = values.map((value, i) => ({ type: types[i], value }));

    // Check if they called as hashPayload([...]) instead of hashPayload(...)
    const params = Array.isArray(zip) ? zip[0] as any as Param[] : zip; // tslint:disable-line: no-any
    return soliditySha3(...params);
};

// Generates the gateway address
const generateAddress = (_to: string, _shiftAction: ShiftAction, _payload: Payload): string => {
    const chain = actionToDetails(_shiftAction).from;
    switch (chain) {
        case Chain.Bitcoin:
            return createBTCTestnetAddress(_to, hashPayload(_payload));
        case Chain.ZCash:
            return createZECTestnetAddress(_to, hashPayload(_payload));
        default:
            throw new Error(`Unable to generate deposit address for chain ${chain}`);
    }
};

// Retrieves unspent deposits at the provided address
const retrieveDeposits = async (_shiftAction: ShiftAction, _depositAddress: string, _limit = 10, _confirmations = 0): Promise<UTXO[]> => {
    const chain = actionToDetails(_shiftAction).from;
    switch (chain) {
        case Chain.Bitcoin:
            return (await getBTCTestnetUTXOs(_depositAddress, _limit, _confirmations)).map(utxo => ({ chain: Chain.Bitcoin, utxo }));
        case Chain.ZCash:
            return (await getZECTestnetUTXOs(_depositAddress, _limit, _confirmations)).map(utxo => ({ chain: Chain.ZCash, utxo }));
        default:
            throw new Error(`Unable to retrieve deposits for chain ${chain}`);
    }
};

const SECONDS = 1000;
// tslint:disable-next-line: no-string-based-set-timeout
const sleep = async (timeout: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, timeout));

export default class RenSDK {

    // Expose functions
    public hashPayload = hashPayload;

    // Internal state
    // tslint:disable-next-line: no-any
    private readonly adapter: any;
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
    // TODO: Flatten into multiple functions
    public shift = async (shiftAction: ShiftAction, to: string, amount: number | string, nonce: string, payload: Payload) => {
        const gatewayAddress = generateAddress(this.adapter.address, shiftAction, payload);
        return {
            addr: () => gatewayAddress,
            wait: this._waitAfterShift(shiftAction, to, amount, nonce, payload, gatewayAddress),
        };
    }

    private readonly _waitAfterShift = (shiftAction: ShiftAction, to: string, amount: number | string, nonce: string, payload: Payload, gatewayAddress: string) =>
        async (confirmations: number) => {
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

    private readonly _submitDepositAfterShift = (shiftAction: ShiftAction, to: string, amount: number | string, nonce: string, payload: Payload, gatewayAddress: string, deposits: any) =>
        () => {
            // Hash the payload
            const pHash = this.hashPayload(payload);

            let messageIDEvent: string;

            // Submit the deposit to the darknodes
            const submitPromise = this.darknodeGroup.submitDeposits(shiftAction, to, pHash).then(async (messageID: string) => {
                messageIDEvent = messageID;

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

                return {
                    signAndSubmit: this._signAndSubmitAfterShift(shiftAction, to, amount, nonce, payload, gatewayAddress, deposits, response),
                };
            });

            // TODO: Use github.com/primus/eventemitter3
            const onMessageID = async () => {
                while (!messageIDEvent) {
                    await sleep(1 * SECONDS);
                }

                return messageIDEvent;
            };

            return {
                then: submitPromise.then,
                catch: submitPromise.catch,
                finally: submitPromise.finally,
                onMessageID,
            };
        }

    private readonly _signAndSubmitAfterShift = (shiftAction: ShiftAction, to: string, amount: number | string, nonce: string, payload: Payload, gatewayAddress: string, deposits: any, response: ShiftedInResponse | ShiftedOutResponse) =>
        async (web3: Web3, methodName: string) => {
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

            // tslint:disable-next-line: no-non-null-assertion
            const ABI = [{ ...shiftInABITemplate, name: methodName, inputs: [...shiftInABITemplate.inputs!, ...payload.map(value => ({ type: value.type, name: `${value.value}` }))] }];

            const contract = new web3.eth.Contract(ABI, to);

            const addresses = await web3.eth.getAccounts();

            return contract.methods.trade(
                ...params,
            ).send({ from: addresses[0] });
        }
}
