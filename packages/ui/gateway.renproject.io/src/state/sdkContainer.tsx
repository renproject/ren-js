import {
    Asset, GatewayMessageType, HistoryEvent, RenContract, SerializableShiftOutParams, ShiftInEvent,
    ShiftInParams, ShiftInStatus, ShiftOutEvent, ShiftOutParams, ShiftOutStatus, Tx, TxStatus,
} from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { ShiftIn } from "@renproject/ren/build/main/shiftIn";
import { parseRenContract, resolveInToken, UTXO } from "@renproject/utils";
import { NetworkDetails } from "@renproject/utils/build/main/types/networks";
import { Container } from "unstated";

import { getStorageItem, updateStorageTrade } from "../components/controllers/Storage";
// tslint:disable-next-line: ordered-imports
import { _catchBackgroundErr_, _catchInteractionErr_, _ignoreErr_ } from "../lib/errors";
import { postMessageToClient } from "../lib/postMessage";
import { compareShiftStatus, compareTxStatus, isFunction, isPromise } from "../lib/utils";
import { Token } from "./generalTypes";
import { UIContainer } from "./uiContainer";

const BitcoinTx = (hash: string): Tx => ({ hash, chain: RenJS.Chains.Bitcoin });
const ZCashTx = (hash: string): Tx => ({ hash, chain: RenJS.Chains.Zcash });
const BCashTx = (hash: string): Tx => ({ hash, chain: RenJS.Chains.BitcoinCash });
const EthereumTx = (hash: string): Tx => ({ hash, chain: RenJS.Chains.Ethereum });

const initialState = {
    sdkRenVM: null as null | RenJS,
    // sdkAddress: null as string | null,
    // sdkWeb3: null as Web3 | null,
    shift: null as HistoryEvent | null,
};

export const numberOfConfirmations = (renContract: "BTC" | "ZEC" | "BCH" | RenContract, networkDetails: NetworkDetails | undefined) =>
    (parseRenContract(resolveInToken(renContract)).asset === Asset.ZEC ? 6 : 2) /
    // Confirmations are halved on devnet
    (networkDetails && networkDetails.name === "devnet" ? 2 : 1);

/**
 * The SDKContainer is responsible for talking to the RenVM SDK. It stores the
 * associated state and exposes functions to interact with the SDK.
 *
 * The main two interactions are shifting in (trading BTC to DAI), and shifting
 * out (trading DAI to BTC).
 */
export class SDKContainer extends Container<typeof initialState> {
    public state = initialState;
    private readonly uiContainer: UIContainer;

    constructor(uiContainer: UIContainer) {
        super();
        this.uiContainer = uiContainer;
    }

    public connect = async (network: string): Promise<void> => {
        // public connect = async (web3: Web3, address: string | null, network: string): Promise<void> => {
        await this.setState({
            // sdkWeb3: web3,
            sdkRenVM: new RenJS(network),
            // sdkAddress: address,
        });

        // const shift = await this.fixShift(this.state.shift, web3);
        // if (shift) {
        //     await this.updateShift(shift, { sync: true });
        // }
    }

    // public fixShift = async (shift: HistoryEvent | null, web3: Web3) => {
    //     if (shift && shift.shiftParams.contractCalls) {
    //         for (let i = 0; i < shift.shiftParams.contractCalls.length; i++) {
    //             const contractCall = shift.shiftParams.contractCalls[i];
    //             if (isFunction(contractCall)) {
    //                 try {
    //                     shift.shiftParams.contractCalls[i] = await contractCall(web3.currentProvider);
    //                 } catch (error) {
    //                     _ignoreErr_(error);
    //                 }
    //             } else if (isPromise(contractCall)) {
    //                 try {
    //                     shift.shiftParams.contractCalls[i] = await contractCall;
    //                 } catch (error) {
    //                     _ignoreErr_(error);
    //                 }
    //             }
    //         }
    //     }
    //     return shift;
    // }

    public getNumberOfConfirmations = (shift?: HistoryEvent) => {
        shift = shift || this.state.shift || undefined;
        if (!shift) {
            throw new Error("Shift not set");
        }
        // tslint:disable-next-line: strict-type-predicates
        const confirmations = shift.shiftIn && shift.shiftParams.confirmations !== null && shift.shiftParams.confirmations !== undefined ?
            shift.shiftParams.confirmations :
            numberOfConfirmations(shift.shiftParams.sendToken, this.state.sdkRenVM ? this.state.sdkRenVM.network : undefined);
        return confirmations;
    }

    public getShiftStatus = (shift?: HistoryEvent) => {
        shift = shift || this.state.shift || undefined;
        if (!shift) { throw new Error("Shift not set"); }
        return { status: shift.status, details: null };
    }

    public returnShift = async (shift?: HistoryEvent) => {
        if (!this.uiContainer.state.gatewayPopupID) {
            throw new Error("Can't return without shift ID");
        }

        await this.updateShift({ returned: true });


        const response = await this.queryShiftStatus();
        console.log(response);

        await postMessageToClient(window, this.uiContainer.state.gatewayPopupID, GatewayMessageType.Done, response);
    }

    public updateShift = async (shiftIn: Partial<HistoryEvent>, options?: { sync?: boolean }) => {
        const renNetwork = this.uiContainer.state.renNetwork;
        if (!renNetwork) {
            throw new Error(`Error trying to update shift in storage without network being defined.`);
        }

        let existingShift: HistoryEvent | Partial<HistoryEvent> = {};
        if (options && options.sync && shiftIn.shiftParams && shiftIn.shiftParams.nonce) {
            existingShift = await getStorageItem(renNetwork, shiftIn.shiftParams.nonce) || {};
        }

        const min = (firstValue: (number | null | undefined), ...values: Array<number | null | undefined>): (number | null | undefined) => {
            return values.reduce((acc, value) => (acc === null || acc === undefined || (value !== undefined && value !== null && value < acc) ? value : acc), firstValue);
        };

        // tslint:disable-next-line: no-object-literal-type-assertion
        const shift = {
            ...existingShift,
            ...this.state.shift,
            ...shiftIn,
            // tslint:disable-next-line: no-any
            time: min(existingShift.time, this.state.shift && this.state.shift.time, shiftIn.time),
            inTx: shiftIn.inTx || (this.state.shift && this.state.shift.inTx) || existingShift.inTx,
            outTx: shiftIn.outTx || (this.state.shift && this.state.shift.outTx) || existingShift.outTx,
            renTxHash: shiftIn.renTxHash || (this.state.shift && this.state.shift.renTxHash) || existingShift.renTxHash,
            renVMQuery: shiftIn.renVMQuery || (this.state.shift && this.state.shift.renVMQuery) || existingShift.renVMQuery,
            renVMStatus: compareTxStatus(existingShift.renVMStatus, (this.state.shift && this.state.shift.renVMStatus), shiftIn.renVMStatus),
            status: compareShiftStatus(existingShift.status, (this.state.shift && this.state.shift.status), shiftIn.status),
        } as HistoryEvent;

        // const web3 = this.state.sdkWeb3;
        // if (web3) {
        //     shift = (await this.fixShift(shift, web3)) || shift;
        // }

        if (
            shift.status &&
            (!this.state.shift || (this.state.shift.status !== shift.status)) &&
            this.uiContainer.state.gatewayPopupID
        ) {
            await postMessageToClient(window, this.uiContainer.state.gatewayPopupID, GatewayMessageType.Status, this.getShiftStatus(shift));
        }
        try {
            await updateStorageTrade(renNetwork, shift);
        } catch (error) {
            console.error(error);
        }
        await this.setState({ shift });
    }

    public updateToAddress = async (address: string, token: Token) => {
        if (!this.state.shift) {
            return;
        }

        const sendToken = (this.state.shift.shiftParams as ShiftInParams | ShiftOutParams).sendToken;
        const defaultToken = sendToken && (sendToken.slice(0, 3) as Token);
        const contractCalls = this.state.shift.shiftParams.contractCalls ? Array.from(this.state.shift.shiftParams.contractCalls).map(contractCall => {
            return (isFunction(contractCall) || isPromise(contractCall)) ? contractCall : contractCall.contractParams && contractCall.contractParams.map(param => {
                const match = param && typeof param.value === "string" ? param.value.match(/^__renAskForAddress__([a-zA-Z0-9]+)?$/) : null;
                try {
                    if (match && (match[1] === token || (!match[1] && token === defaultToken))) {
                        return { ...param, value: RenJS.Tokens[token].addressToHex(address) };
                    }
                } catch (error) {
                    _catchInteractionErr_(error, "...");
                }
                return param;
            });
        }) : this.state.shift.shiftParams.contractCalls;
        if (contractCalls) {
            let partial: Partial<HistoryEvent>;
            if (this.state.shift.shiftIn) {
                partial = { shiftIn: this.state.shift.shiftIn, shiftParams: { ...this.state.shift.shiftParams, contractCalls } as unknown as ShiftInEvent["shiftParams"] };
            } else {
                partial = { shiftIn: this.state.shift.shiftIn, shiftParams: { ...this.state.shift.shiftParams, contractCalls } as unknown as ShiftOutEvent["shiftParams"] };
            }
            await this.updateShift(partial);
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Shift out ///////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    public submitBurnToEthereum = async (retry = false) => {
        const { sdkRenVM: renVM } = this.state;
        // const { sdkAddress: address, sdkWeb3: web3, sdkRenVM: renVM } = this.state;
        if (!renVM) {
            throw new Error(`Invalid values required for swap`);
        }
        const shift = this.state.shift;
        if (!shift) {
            throw new Error("Shift not set");
        }
        if (shift.shiftIn) {
            throw new Error(`Expected shift-out details but got shift-in`);
        }
        const { gatewayPopupID } = this.uiContainer.state;
        if (!gatewayPopupID) {
            throw new Error(`No gateway popup ID.`);
        }

        const params: SerializableShiftOutParams = shift.shiftParams;

        // if (retry) {
        //     await this.approveTokenTransfer(shiftID);
        // }

        // If there's a previous transaction and `retry` isn't set, reuse tx.
        let transactionHash = shift.inTx && !retry ? shift.inTx.hash : null;

        if (!transactionHash) {

            const transactionConfigs = renVM.shiftOut({
                ...params
            }).createTransactions();

            for (let i = 0; i < transactionConfigs.length; i++) {
                const transactionConfig = transactionConfigs[i];

                const { txHash, error: sendTransactionError } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.SendTransaction, { transactionConfig });
                if (sendTransactionError) {
                    throw new Error(sendTransactionError);
                }

                if (!txHash) {
                    throw new Error("No txHash returned from Web3");
                }

                if (i === transactionConfigs.length - 1) {
                    transactionHash = txHash;

                    await this.updateShift({
                        inTx: EthereumTx(txHash),
                        status: ShiftOutStatus.SubmittedToEthereum,
                    });
                }

                const { error } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.GetTransactionStatus, { txHash });
                if (error) {
                    throw new Error(error);
                }
            }
        } else {
            const { error } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.GetTransactionStatus, { txHash: transactionHash });
            if (error) {
                throw new Error(error);
            }
        }

        await this.updateShift({
            status: ShiftOutStatus.ConfirmedOnEthereum,
        });
    }

    public submitBurnToRenVM = async (_resubmit = false) => {
        // if (resubmit) {
        //     await this.updateShift({ status: ShiftOutStatus.ConfirmedOnEthereum, renTxHash: null });
        // }

        const { sdkRenVM: renVM } = this.state;
        // if (!web3) { throw new Error(`Web3 not initialized`); }
        if (!renVM) { throw new Error(`RenVM not initialized`); }

        const shift = this.state.shift;
        if (!shift) { throw new Error("Shift not set"); }
        if (!shift.inTx) { throw new Error(`Invalid values required to submit deposit`); }

        const { gatewayPopupID } = this.uiContainer.state;
        if (!gatewayPopupID) {
            throw new Error(`No gateway popup ID.`);
        }

        const { burnReference, error: getTransactionBurnError } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.GetTransactionBurn, { txHash: shift.inTx.hash });
        if (getTransactionBurnError) {
            throw new Error(getTransactionBurnError);
        }

        const shiftOutObject = await renVM.shiftOut({
            sendToken: shift.shiftParams.sendToken,
            burnReference,
        }).readFromEthereum();

        const renTxHash = shiftOutObject.renTxHash();
        this.updateShift({
            renTxHash,
            status: ShiftOutStatus.SubmittedToRenVM,
        }).catch((updateShiftError) => _catchBackgroundErr_(updateShiftError, "Error in sdkContainer: submitBurnToRenVM > renTxHash > updateShift"));

        const response = await shiftOutObject.submitToRenVM()
            .on("status", (renVMStatus: TxStatus) => {
                this.updateShift({
                    renVMStatus,
                }).catch((error) => _catchBackgroundErr_(error, "Error in sdkContainer: submitBurnToRenVM > onStatus > updateShift"));
            });

        await this.updateShift({ renVMQuery: response, renTxHash: response.hash });

        // TODO: Fix returned types for burning
        const address = response.in.to;

        await this.updateShift({
            outTx: shift.shiftParams.sendToken === RenJS.Tokens.ZEC.Eth2Zec ?
                ZCashTx(address) :
                shift.shiftParams.sendToken === RenJS.Tokens.BCH.Eth2Bch ?
                    BCashTx(address) :
                    BitcoinTx(address),
            status: ShiftOutStatus.ReturnedFromRenVM,
        }).catch((error) => _catchBackgroundErr_(error, "Error in sdkContainer: submitBurnToRenVM > updateShift"));
    }

    ////////////////////////////////////////////////////////////////////////////
    // Shift in ////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Shifting in involves the following steps:
    // 1. Generate a gateway address
    // 2. Wait for a deposit to the address
    // 3. Submit the deposit to RenVM and retrieve back a signature
    // 4. Submit the signature to Ethereum

    public shiftInObject = (): ShiftIn => {
        const { sdkRenVM: renVM } = this.state;
        if (!renVM) {
            throw new Error("Invalid parameters passed to `generateAddress`");
        }
        const shift = this.state.shift;
        if (!shift) {
            throw new Error("Shift not set");
        }

        return renVM.shiftIn(shift.shiftParams as ShiftInParams);
    }

    // Takes a shiftParams as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = (): string | undefined => {
        return this
            .shiftInObject()
            .addr();
    }

    // Retrieves unspent deposits at the provided address
    public waitForDeposits = async (onDeposit: (utxo: UTXO) => void) => {
        const shift = this.state.shift;
        if (!shift) {
            throw new Error("Shift not set");
        }
        const onRenTxHash = (renTxHash: string) => {
            const shiftOnHash = this.state.shift;
            if (!shiftOnHash || !shiftOnHash.renTxHash || shiftOnHash.renTxHash !== renTxHash) {
                this.updateShift({ renTxHash })
                    .catch(console.error);
            }
        };
        const onStatus = (renVMStatus: TxStatus) => {
            this.updateShift({
                renVMStatus,
            }).catch(console.error);
        };
        const transaction = await this
            .shiftInObject()
            .waitForDeposit(0);
        const promise = this
            .shiftInObject()
            .waitForDeposit(this.getNumberOfConfirmations(shift));
        promise.on("deposit", (utxo: UTXO) => {
            this.updateShift({ status: ShiftInStatus.Deposited }).catch(error => { _catchBackgroundErr_(error, "Error in sdkContainer.tsx > waitForDeposits"); });
            onDeposit(utxo);
        });
        const signaturePromise = transaction
            .submitToRenVM()
            .on("renTxHash", onRenTxHash)
            .on("status", onStatus);
        const defaultNumberOfConfirmations = numberOfConfirmations(shift.shiftParams.sendToken, this.state.sdkRenVM ? this.state.sdkRenVM.network : undefined);
        if (this.getNumberOfConfirmations(shift) < defaultNumberOfConfirmations) {

            // tslint:disable-next-line: no-constant-condition
            while (true) {
                try {
                    const response = await transaction.queryTx();
                    await this.updateShift({ renVMQuery: response, renTxHash: response.hash });
                    break;
                } catch (error) {
                    // Ignore error
                }
            }

            await this.returnShift();
            return;
        }
        const signature = await signaturePromise;
        await this.updateShift({ status: ShiftInStatus.ReturnedFromRenVM });
        const response = await signature.queryTx();
        await this.updateShift({ renVMQuery: response, renTxHash: response.hash });
    }

    public queryShiftStatus = async () => {
        const { sdkRenVM: renVM, shift } = this.state;

        if (shift && shift.renVMQuery && shift.renVMQuery.txStatus === TxStatus.TxStatusDone) {
            return shift.renVMQuery;
        }

        if (!renVM) { throw new Error(`RenVM not initialized`); }
        if (!shift) { throw new Error("Shift not set"); }

        const renTxHash = shift.renTxHash;
        if (!renTxHash) { throw new Error(`Invalid values required to query status`); }

        if (shift.shiftIn) {
            return renVM.shiftIn({
                sendToken: shift.shiftParams.sendToken,
                renTxHash,
                contractCalls: [],
            }).queryTx();
        } else {
            return renVM.shiftOut({
                sendToken: shift.shiftParams.sendToken,
                renTxHash,
            }).queryTx();
        }
    }

    public submitMintToEthereum = async (retry = false) => {
        const { gatewayPopupID } = this.uiContainer.state;
        const shift = this.state.shift;
        if (!shift) { throw new Error("Shift not set"); }
        if (!gatewayPopupID) {
            throw new Error(`No gateway popup ID.`);
        }

        let transactionHash = shift.outTx && !retry ? shift.outTx.hash : null;
        // let receipt: TransactionReceipt;

        if (!transactionHash) {

            const transaction = await this
                .shiftInObject()
                .waitForDeposit(0);

            const signature = await transaction
                .submitToRenVM();

            const transactionConfigs = signature.createTransactions();

            for (let i = 0; i < transactionConfigs.length; i++) {
                const transactionConfig = transactionConfigs[i];
                const { txHash, error: sendTransactionError } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.SendTransaction, { transactionConfig });
                if (sendTransactionError) {
                    throw new Error(sendTransactionError);
                }

                if (!txHash) {
                    throw new Error("No txHash returned from Web3");
                }

                if (i === transactionConfigs.length - 1) {
                    transactionHash = txHash;
                }
            }

            transactionHash = transactionHash || "";

            // const txHash = await new Promise<string>((resolveTx, rejectTx) => promiEvent
            //     .on("transactionHash", resolveTx).catch(rejectTx));

            // Update shift in store.
            await this.updateShift({
                status: ShiftInStatus.SubmittedToEthereum,
                outTx: EthereumTx(transactionHash),
            });

            // tslint:disable-next-line: no-any
            // promiEvent.once("confirmation", (_confirmations: number, newReceipt: any) => { resolve([newReceipt, txHash]); });
            // });
            // } else {
            // receipt = (await this.getReceipt(web3, transactionHash)) as TransactionReceipt;
        }

        // // tslint:disable-next-line: no-any
        // if ((receipt as any).status === 0 || receipt.status === false || (receipt as any).status === "0x0") {
        //     throw new Error(`Transaction ${transactionHash} was reverted.`);
        // }

        const { error: getTransactionStatusError } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.GetTransactionStatus, { txHash: transactionHash });
        if (getTransactionStatusError) {
            throw new Error(getTransactionStatusError);
        }

        // Update shift in store.
        await this.updateShift({
            outTx: EthereumTx(transactionHash),
            status: ShiftInStatus.ConfirmedOnEthereum,
        });

        return;
    }

    // private readonly getReceipt = async (web3: Web3, transactionHash: string) => {
    //     // Wait for confirmation
    //     let receipt;
    //     while (!receipt || !receipt.blockHash) {
    //         receipt = await web3.eth.getTransactionReceipt(transactionHash);
    //         if (receipt && receipt.blockHash) {
    //             break;
    //         }
    //         await sleep(3 * 1000);
    //     }

    //     // Status might be undefined - so check against `false` explicitly.
    //     if (receipt.status === false) {
    //         throw new Error(`Transaction was reverted. { "transactionHash": "${transactionHash}" }`);
    //     }

    //     return receipt;
    // }
}
