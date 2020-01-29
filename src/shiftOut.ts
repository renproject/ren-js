import BN from "bn.js";
import Web3 from "web3";

import { payloadToABI } from "./lib/abi";
import { forwardEvents, newPromiEvent, PromiEvent } from "./lib/promievent";
import {
    BURN_TOPIC, generateTxHash, ignoreError, strip0x, waitForReceipt, withDefaultAccount,
} from "./lib/utils";
import { ShifterNetwork } from "./renVM/shifterNetwork";
import { QueryBurnResponse } from "./renVM/transaction";
import { ShiftOutParams, ShiftOutParamsAll } from "./types/parameters";

export class ShiftOutObject {
    private readonly params: ShiftOutParamsAll;
    private readonly renVMNetwork: ShifterNetwork;

    constructor(renVMNetwork: ShifterNetwork, params: ShiftOutParams) {
        this.renVMNetwork = renVMNetwork;
        this.params = params;
    }

    public readFromEthereum = (): PromiEvent<ShiftOutObject> => {

        const promiEvent = newPromiEvent<ShiftOutObject>();

        (async () => {

            const { txConfig, web3Provider, contractFn, contractParams, sendTo } = this.params;
            let { burnReference } = this.params;
            let ethTxHash = this.params.ethTxHash || this.params.txHash;

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

                    ethTxHash = await new Promise((resolve, reject) => tx
                        .on("transactionHash", resolve)
                        .catch((error: Error) => {
                            try { if (ignoreError(error)) { console.error(String(error)); return; } } catch (_error) { /* Ignore _error */ }
                            reject(error);
                        })
                    );
                }

                if (!ethTxHash) {
                    throw new Error("Must provide txHash or contract call details");
                }

                // Handle (3) and continue handling (2)
                // Given a transaction hash, look through the receipts for a
                // ShiftOut event.
                // @dev WARNING: If multiple shiftOuts are present, ShiftOut
                // should be called for each one, passing in the reference IDs.
                const receipt = await waitForReceipt(web3, ethTxHash);

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

            this.params.burnReference = burnReference;

            return this;

        })().then(promiEvent.resolve).catch(promiEvent.reject);

        // TODO: Look into why .catch isn't being called on tx
        promiEvent.on("error", (error) => {
            try { if (ignoreError(error)) { console.error(String(error)); return; } } catch (_error) { /* Ignore _error */ }
            promiEvent.reject(error);
        });

        return promiEvent;
    }

    public renTxHash = () => {
        if (!this.params.burnReference) {
            throw new Error("Must call `readFromEthereum` before calling `renTxHash`");
        }
        return generateTxHash(this.params.sendToken, this.params.burnReference);
    }

    public queryTx = async () => this.renVMNetwork.queryTX<QueryBurnResponse>(this.renTxHash());

    public submitToRenVM = (): PromiEvent<QueryBurnResponse> => {
        const promiEvent = newPromiEvent<QueryBurnResponse>();

        (async () => {
            const burnReference = this.params.burnReference;
            if (!burnReference) {
                throw new Error("Must call `readFromEthereum` before calling `submitToRenVM`");
            }

            const burnReferenceNumber = new BN(strip0x(burnReference), "hex").toString();

            const renTxHash = generateTxHash(this.params.sendToken, burnReferenceNumber);

            // const renTxHash = await this.renVMNetwork.submitTokenFromEthereum(this.params.sendToken, burnReference);
            promiEvent.emit("messageID", renTxHash);
            promiEvent.emit("renTxHash", renTxHash);

            return await this.renVMNetwork.waitForTX<QueryBurnResponse>(renTxHash, (status) => {
                promiEvent.emit("status", status);
            });
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }
}
