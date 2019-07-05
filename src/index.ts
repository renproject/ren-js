// tslint:disable: no-use-before-declare

import Web3 from "web3";

import { payloadToABI } from "./lib/abi";
import { forwardEvents, newPromiEvent, PromiEvent } from "./lib/promievent";
import { BURN_TOPIC, ignoreError, withDefaultAccount } from "./lib/utils";
import { RenVMNetwork } from "./lightnode/renVMNetwork";
import { ShiftInObject } from "./shiftIn";
import { ShiftOutObject } from "./shiftOut";
import { Chain, Tokens } from "./types/assets";
import { Network, NetworkDetails, stringToNetwork } from "./types/networks";
import { ShiftInParams, ShiftOutParams, ShiftOutParamsAll } from "./types/parameters";

export * from "./lightnode/renVMNetwork";
export * from "./blockchain/btc";
export * from "./blockchain/zec";
export * from "./blockchain/common";
export * from "./types/assets";
export * from "./types/networks";
export * from "./types/parameters";
export * from "./shiftIn";
export * from "./shiftOut";

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
        this.network = stringToNetwork(network);
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

            const { txConfig, sendToken, web3Provider, contractFn, contractParams, sendTo } = params as ShiftOutParamsAll;
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
                if (contractParams && contractFn && sendTo) {

                    const callParams = [
                        ...contractParams.map(value => value.value),
                    ];

                    const ABI = payloadToABI(contractFn, contractParams);
                    const contract = new web3.eth.Contract(ABI, sendTo);

                    const tx = contract.methods[contractFn](
                        ...callParams,
                    ).send(await withDefaultAccount(web3, {
                        ...txConfig,
                    }));

                    forwardEvents(tx, promiEvent);

                    txHash = await new Promise((resolve, reject) => tx
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
