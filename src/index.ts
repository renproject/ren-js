import Web3 from "web3";

import { BitcoinUTXO, createBTCTestnetAddress, getBTCTestnetUTXOs } from "./blockchain/btc";
import { createZECTestnetAddress, getZECTestnetUTXOs, ZcashUTXO } from "./blockchain/zec";
import {
    lightnodes, ShiftedInResponse, ShiftedOutResponse, ShifterGroup,
} from "./darknode/darknodeGroup";

export type UTXO = { chain: Chain.Bitcoin, utxo: BitcoinUTXO } | { chain: Chain.ZCash, utxo: ZcashUTXO };

export enum Chain {
    Bitcoin = "btc",
    Ethereum = "eth",
    ZCash = "zec",
}

export default class RenSDK {
    // private readonly web3: Web3;
    // tslint:disable-next-line: no-any
    private readonly adapter: any;
    private readonly darknodeGroup: ShifterGroup;

    // Takes the address of the adapter smart contract
    constructor(web3: Web3, adapterAddress: string) {
        // this.web3 = web3;
        this.adapter = new web3.eth.Contract([], adapterAddress);
        this.darknodeGroup = new ShifterGroup(lightnodes);
    }

    // Takes a commitment as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = (chain: Chain, commitmentHash: string): string => {
        switch (chain) {
            case Chain.Bitcoin:
                return createBTCTestnetAddress(this.adapter.address, commitmentHash);
            case Chain.ZCash:
                return createZECTestnetAddress(this.adapter.address, commitmentHash);
            default:
                throw new Error(`Unable to generate deposit address for chain ${chain}`);
        }
    }

    // Retrieves unspent deposits at the provided address
    public retrieveDeposits = async (chain: Chain, depositAddress: string, limit = 10, confirmations = 0): Promise<UTXO[]> => {
        switch (chain) {
            case Chain.Bitcoin:
                return (await getBTCTestnetUTXOs(depositAddress, limit, confirmations)).map(utxo => ({ chain: Chain.Bitcoin, utxo }));
            case Chain.ZCash:
                return (await getZECTestnetUTXOs(depositAddress, limit, confirmations)).map(utxo => ({ chain: Chain.ZCash, utxo }));
            default:
                throw new Error(`Unable to retrieve deposits for chain ${chain}`);
        }
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public shift = async (chain: Chain, transaction: UTXO, commitmentHash: string): Promise<string> => {
        const responses = await this.darknodeGroup.submitDeposits(chain, this.adapter.address, commitmentHash);
        const first = responses.first(undefined);
        if (first === undefined) {
            throw new Error(`Error submitting to darknodes`);
        }
        return first.messageID;
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public burn = async (chain: Chain, to: string, valueHex: string): Promise<string> => {
        const responses = await this.darknodeGroup.submitWithdrawal(chain, to, valueHex);
        const first = responses.first(undefined);
        if (first === undefined) {
            throw new Error(`Error submitting to darknodes`);
        }
        return first.messageID;
    }

    // Retrieves the current progress of the shift
    public shiftStatus = async (messageID: string): Promise<ShiftedInResponse | ShiftedOutResponse> => {
        return /*await*/ this.darknodeGroup.checkForResponse(messageID);
    }
}
