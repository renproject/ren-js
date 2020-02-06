import { sleep } from "@renproject/react-components";
import RenJS, {
    NetworkDetails, parseRenContract, ShiftInObject, Signature, TxStatus, UTXO,
} from "@renproject/ren";
import {
    Asset, HistoryEvent, RenContract, RenVMArg, RenVMType, SendTokenInterface, ShiftInEvent,
    ShiftInParams, ShiftInParamsAll, ShiftInStatus, ShiftNonce, ShiftOutEvent, ShiftOutParams,
    ShiftOutParamsAll, ShiftOutStatus,
} from "@renproject/ren-js-common";
import { Container } from "unstated";
import Web3 from "web3";
import { TransactionReceipt } from "web3-core";

import { updateStorageTrade } from "../components/controllers/Storage";
// tslint:disable-next-line: ordered-imports
import { _catchBackgroundErr_, _catchInteractionErr_, isPromise } from "../lib/errors";
import { GatewayMessageType, postMessageToClient } from "../lib/postMessage";
import { Token } from "./generalTypes";
import { UIContainer } from "./uiContainer";

const BitcoinTx = (hash: string) => ({ hash, chain: RenJS.Chains.Bitcoin });
const ZCashTx = (hash: string) => ({ hash, chain: RenJS.Chains.Zcash });
const BCashTx = (hash: string) => ({ hash, chain: RenJS.Chains.BitcoinCash });
const EthereumTx = (hash: string) => ({ hash, chain: RenJS.Chains.Ethereum });

const initialState = {
    sdkRenVM: null as null | RenJS,
    sdkAddress: null as string | null,
    sdkWeb3: null as Web3 | null,
    shift: null as HistoryEvent | null,
};

export const numberOfConfirmations = (renContract: RenContract, networkDetails: NetworkDetails | undefined) => {
    let confirmations = (parseRenContract(renContract).asset === Asset.ZEC ? 6 : 2);

    // Confirmations are halved on devnet
    if (networkDetails && networkDetails.name === "devnet") { confirmations /= 2; }

    return confirmations;
};


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

    public connect = async (web3: Web3, address: string | null, network: string): Promise<void> => {
        await this.setState({
            sdkWeb3: web3,
            sdkRenVM: new RenJS(network),
            sdkAddress: address,
        });
    }

    public getShiftStatus = (shift?: HistoryEvent) => {
        shift = shift || this.state.shift || undefined;
        if (!shift) {
            throw new Error("Shift not set");
        }
        return { status: this.state.shift?.status, details: null };
    }

    public updateShift = async (shiftIn: Partial<HistoryEvent>) => {

        const renNetwork = this.uiContainer.state.renNetwork;
        if (!renNetwork) {
            throw new Error(`Error trying to update shift in storage without network being defined.`);
        }

        // tslint:disable-next-line: no-object-literal-type-assertion
        const shift = { ...this.state.shift, ...shiftIn } as HistoryEvent;
        if (
            shift.status &&
            (!this.state.shift || (this.state.shift.status !== shift.status)) &&
            this.uiContainer.state.gatewayPopupID
        ) {
            postMessageToClient(window, this.uiContainer.state.gatewayPopupID, GatewayMessageType.Status, this.getShiftStatus(shift));
        }
        await updateStorageTrade(renNetwork, shift);
        await this.setState({ shift });
    }

    public updateToAddress = async (address: string, token: Token) => {
        if (!this.state.shift) {
            return;
        }

        const defaultToken = (this.state.shift.shiftParams as ShiftInParamsAll | ShiftOutParamsAll).sendToken?.slice(0, 3) as Token;
        const contractCalls = this.state.shift.shiftParams.contractCalls ? Array.from(this.state.shift.shiftParams.contractCalls).map(contractCall => {
            return isPromise(contractCall) ? contractCall : contractCall.contractParams?.map(param => {
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

    public getReceipt = async (web3: Web3, transactionHash: string) => {
        // Wait for confirmation
        let receipt;
        while (!receipt || !receipt.blockHash) {
            receipt = await web3.eth.getTransactionReceipt(transactionHash);
            if (receipt && receipt.blockHash) {
                break;
            }
            await sleep(3 * 1000);
        }

        // Status might be undefined - so check against `false` explicitly.
        if (receipt.status === false) {
            throw new Error(`Transaction was reverted. { "transactionHash": "${transactionHash}" }`);
        }

        return receipt;
    }

    public submitBurnToEthereum = async (retry = false) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkRenVM: renVM } = this.state;
        if (!web3 || !renVM || !address) {
            throw new Error(`Invalid values required for swap`);
        }
        const shift = this.state.shift;
        if (!shift) {
            throw new Error("Shift not set");
        }
        if (shift.shiftIn) {
            throw new Error(`Expected shift-out details but got shift-in`);
        }

        const params: Exclude<ShiftOutParamsAll & SendTokenInterface & ShiftNonce, "web3Provider"> = shift.shiftParams;

        // if (retry) {
        //     await this.approveTokenTransfer(shiftID);
        // }

        // If there's a previous transaction and `retry` isn't set, reuse tx.
        let transactionHash = shift.inTx && !retry ? shift.inTx.hash : null;

        if (!transactionHash) {
            const promiEvent = renVM.shiftOut({
                web3Provider: web3.currentProvider,
                // tslint:disable-next-line: no-any
                ...(params as ShiftOutParams),
            }).readFromEthereum();

            promiEvent.catch((error: Error) => {
                throw error;
            });
            transactionHash = await new Promise<string>((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));
            await this.updateShift({
                inTx: EthereumTx(transactionHash),
                status: ShiftOutStatus.SubmittedToEthereum,
            });
        }

        // Wait for confirmation
        await this.getReceipt(web3, transactionHash);

        await this.updateShift({
            status: ShiftOutStatus.ConfirmedOnEthereum,
        });
    }

    public submitBurnToRenVM = async (_resubmit = false) => {
        // if (resubmit) {
        //     await this.updateShift({ status: ShiftOutStatus.ConfirmedOnEthereum, renTxHash: null });
        // }

        const { sdkWeb3: web3, sdkRenVM: renVM } = this.state;
        if (!web3 || !renVM) {
            throw new Error(`Invalid values required to submit deposit`);
        }

        const shift = this.state.shift;
        if (!shift) {
            throw new Error("Shift not set");
        }

        if (!shift.inTx) {
            throw new Error(`Invalid values required to submit deposit`);
        }

        const shiftOutObject = await renVM.shiftOut({
            web3Provider: web3.currentProvider,
            // tslint:disable-next-line: no-any
            sendToken: shift.shiftParams.sendToken as any,
            ethTxHash: shift.inTx.hash
        }).readFromEthereum();

        const response = await shiftOutObject.submitToRenVM()
            .on("renTxHash", (renTxHash: string) => {
                this.updateShift({
                    renTxHash,
                    status: ShiftOutStatus.SubmittedToRenVM,
                }).catch((error) => _catchBackgroundErr_(error, "Error in sdkContainer: submitBurnToRenVM > submitToRenVM"));
            })
            .on("status", (renVMStatus: TxStatus) => {
                this.updateShift({
                    renVMStatus,
                }).catch((error) => _catchBackgroundErr_(error, "Error in sdkContainer: submitBurnToRenVM > onStatus > updateShift"));
            });
        // tslint:disable-next-line: no-any
        // TODO: Fix returned types for burning
        const toArg = response.tx.in[1] as unknown as RenVMArg<"to", RenVMType.TypeB>;
        if (toArg.name !== "to") {
            console.groupCollapsed(`Unable to read field "to" from RenVM response.`);
            console.log(response);
            console.groupEnd();
            throw new Error(`Unable to read field "to" from RenVM response.`);
        }
        const address = toArg.value;
        await this.updateShift({
            outTx: shift.shiftParams.sendToken === RenJS.Tokens.ZEC.Eth2Zec ?
                ZCashTx(RenJS.utils.zec.addressFrom(address, "base64")) :
                shift.shiftParams.sendToken === RenJS.Tokens.BCH.Eth2Bch ?
                    // BCashTx(bchAddressFrom(address, "base64")) :
                    BCashTx(address) :
                    BitcoinTx(RenJS.utils.btc.addressFrom(address, "base64")),
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

    public shiftInObject = (): ShiftInObject => {
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

        const promise = this
            .shiftInObject()
            .waitForDeposit(numberOfConfirmations(shift.shiftParams.sendToken, this.state.sdkRenVM ? this.state.sdkRenVM.network : undefined));
        promise.on("deposit", (utxo: UTXO) => {
            this.updateShift({ status: ShiftInStatus.Deposited }).catch(error => _catchBackgroundErr_(error, "Error in sdkContainer.tsx > waitForDeposits"));
            onDeposit(utxo);
        });
        await promise;
        await this.updateShift({ status: ShiftInStatus.Confirmed });
    }

    // Submits the shiftParams and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public submitMintToRenVM = async (_resubmit = false): Promise<Signature> => {
        // if (resubmit) {
        //     await this.updateShift({ status: ShiftInStatus.Deposited, renTxHash: null });
        // }
        const onRenTxHash = (renTxHash: string) => {
            const shiftOnHash = this.state.shift;
            if (!shiftOnHash || !shiftOnHash.renTxHash || shiftOnHash.renTxHash !== renTxHash) {
                this.updateShift({ renTxHash, status: ShiftInStatus.SubmittedToRenVM })
                    .catch(console.error);
            }
        };
        const onStatus = (renVMStatus: TxStatus) => {
            this.updateShift({
                renVMStatus,
            }).catch(console.error);
        };
        const shift = this.state.shift;
        if (!shift) {
            throw new Error("Shift not set");
        }
        const shiftInObject = this
            .shiftInObject()
            .waitForDeposit(numberOfConfirmations(shift.shiftParams.sendToken, this.state.sdkRenVM ? this.state.sdkRenVM.network : undefined));
        await sleep(10 * 1000);
        const obj = await shiftInObject;
        const signature = await obj
            .submitToRenVM()
            .on("renTxHash", onRenTxHash)
            .on("status", onStatus);
        await this.updateShift({
            inTx: BitcoinTx(RenJS.utils.Ox(Buffer.from(signature.response.in.utxo.txHash, "base64"))),
            status: ShiftInStatus.ReturnedFromRenVM,
        });
        return signature;
    }

    public submitMintToEthereum = async (retry = false) => {
        const { sdkAddress: address, sdkWeb3: web3 } = this.state;
        if (!web3 || !address) {
            throw new Error(`Invalid values required for swap`);
        }
        const shift = this.state.shift;
        if (!shift) {
            throw new Error("Shift not set");
        }

        let transactionHash = shift.outTx && !retry ? shift.outTx.hash : null;
        let receipt: TransactionReceipt;

        if (!transactionHash) {

            [receipt, transactionHash] = await new Promise<[TransactionReceipt, string]>(async (resolve, reject) => {
                const promiEvent = (await this.submitMintToRenVM()).submitToEthereum(web3.currentProvider);
                promiEvent.catch((error) => {
                    reject(error);
                });
                const txHash = await new Promise<string>((resolveTx, rejectTx) => promiEvent.on("transactionHash", resolveTx).catch(rejectTx));
                await this.updateShift({
                    status: ShiftInStatus.SubmittedToEthereum,
                    outTx: EthereumTx(txHash),
                });

                // tslint:disable-next-line: no-any
                promiEvent.once("confirmation", (_confirmations: number, newReceipt: any) => { resolve([newReceipt, txHash]); });
            });
        } else {
            receipt = (await this.getReceipt(web3, transactionHash)) as TransactionReceipt;
        }

        // tslint:disable-next-line: no-any
        if ((receipt as any).status === 0 || receipt.status === false || (receipt as any).status === "0x0") {
            throw new Error(`Transaction ${transactionHash} was reverted.`);
        }

        await this.updateShift({
            outTx: EthereumTx(transactionHash),
            status: ShiftInStatus.ConfirmedOnEthereum,
        });
        return;
    }
}
