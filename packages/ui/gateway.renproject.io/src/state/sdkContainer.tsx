import {
    Asset, BurnAndReleaseEvent, BurnAndReleaseParams, BurnAndReleaseStatus, Chain, EventType,
    GatewayMessageType, HistoryEvent, LockAndMintEvent, LockAndMintParams, LockAndMintStatus,
    NetworkDetails, RenContract, SerializableBurnAndReleaseParams, Tx, TxStatus, UTXOWithChain,
} from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { LockAndMint } from "@renproject/ren/build/main/lockAndMint";
import { parseRenContract, resolveInToken, sleep } from "@renproject/utils";
import { Container } from "unstated";

import { getStorageItem, updateStorageTransfer } from "../components/controllers/Storage";
// tslint:disable-next-line: ordered-imports
import { _catchBackgroundErr_, _catchInteractionErr_, _ignoreErr_ } from "../lib/errors";
import { postMessageToClient } from "../lib/postMessage";
import { compareTransferStatus, compareTxStatus, isFunction, isPromise } from "../lib/utils";
import { Token } from "./generalTypes";
import { UIContainer } from "./uiContainer";

const EthereumTx = (hash: string): Tx => ({ hash, chain: RenJS.Chains.Ethereum });

const initialState = {
    sdkRenVM: null as null | RenJS,
    // sdkAddress: null as string | null,
    // sdkWeb3: null as Web3 | null,
    transfer: null as HistoryEvent | null,
};

export const numberOfConfirmations = (renContract: "BTC" | "ZEC" | "BCH" | RenContract, networkDetails: NetworkDetails | undefined) =>
    (parseRenContract(resolveInToken(renContract)).asset === Asset.ZEC ? 6 : 2) /
    // Confirmations are halved on devnet
    (networkDetails && networkDetails.name === "devnet" ? 2 : 1);

/**
 * The SDKContainer is responsible for talking to the RenVM SDK. It stores the
 * associated state and exposes functions to interact with the SDK.
 *
 * The main two interactions are minting (trading BTC to DAI), and burning
 * (trading DAI to BTC).
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
    }

    public getNumberOfConfirmations = (transfer?: HistoryEvent) => {
        transfer = transfer || this.state.transfer || undefined;
        if (!transfer) {
            throw new Error("Transfer not set");
        }
        // tslint:disable-next-line: strict-type-predicates
        const confirmations = transfer.eventType === EventType.LockAndMint && transfer.transferParams.confirmations !== null && transfer.transferParams.confirmations !== undefined ?
            transfer.transferParams.confirmations :
            numberOfConfirmations(transfer.transferParams.sendToken, this.state.sdkRenVM ? this.state.sdkRenVM.network : undefined);
        return confirmations;
    }

    public getTransferStatus = (transfer?: HistoryEvent) => {
        transfer = transfer || this.state.transfer || undefined;
        if (!transfer) { throw new Error("Transfer not set"); }
        return { status: transfer.status, details: null };
    }

    public returnTransfer = async (transfer?: HistoryEvent) => {
        if (!this.uiContainer.state.gatewayPopupID) {
            throw new Error("Can't return without transfer ID");
        }

        await this.updateTransfer({ returned: true });

        const response = await this.queryTransferStatus();

        await postMessageToClient(window, this.uiContainer.state.gatewayPopupID, GatewayMessageType.Done, response);
    }

    public updateTransfer = async (transferIn: Partial<HistoryEvent>, options?: { sync?: boolean, force?: boolean }) => {
        const renNetwork = this.uiContainer.state.renNetwork;
        if (!renNetwork) {
            throw new Error(`Error trying to update transfer in storage without network being defined.`);
        }

        let existingTransfer: HistoryEvent | Partial<HistoryEvent> = {};
        if (options && options.sync && transferIn.transferParams && transferIn.transferParams.nonce) {
            existingTransfer = await getStorageItem(renNetwork, transferIn.transferParams.nonce) || {};
        }

        const min = (firstValue: (number | null | undefined), ...values: Array<number | null | undefined>): (number | null | undefined) => {
            return values.reduce((acc, value) => (acc === null || acc === undefined || (value !== undefined && value !== null && value < acc) ? value : acc), firstValue);
        };

        const force = options && options.force;

        // tslint:disable-next-line: no-object-literal-type-assertion
        const transfer = {
            ...existingTransfer,
            ...this.state.transfer,
            ...transferIn,
            // tslint:disable-next-line: no-any
            time: force && transferIn.hasOwnProperty("time") ? transferIn.time : min(existingTransfer.time, this.state.transfer && this.state.transfer.time, transferIn.time),
            inTx: force && transferIn.hasOwnProperty("inTx") ? transferIn.inTx : transferIn.inTx || (this.state.transfer && this.state.transfer.inTx) || existingTransfer.inTx,
            outTx: force && transferIn.hasOwnProperty("outTx") ? transferIn.outTx : transferIn.outTx || (this.state.transfer && this.state.transfer.outTx) || existingTransfer.outTx,
            txHash: force && transferIn.hasOwnProperty("txHash") ? transferIn.txHash : transferIn.txHash || (this.state.transfer && this.state.transfer.txHash) || existingTransfer.txHash,
            renVMQuery: force && transferIn.hasOwnProperty("renVMQuery") ? transferIn.renVMQuery : transferIn.renVMQuery || (this.state.transfer && this.state.transfer.renVMQuery) || existingTransfer.renVMQuery,
            renVMStatus: force && transferIn.hasOwnProperty("renVMStatus") ? transferIn.renVMStatus : compareTxStatus(existingTransfer.renVMStatus, (this.state.transfer && this.state.transfer.renVMStatus), transferIn.renVMStatus),
            status: force && transferIn.hasOwnProperty("status") ? transferIn.status : compareTransferStatus(existingTransfer.status, (this.state.transfer && this.state.transfer.status), transferIn.status),
        } as HistoryEvent;

        // const web3 = this.state.sdkWeb3;
        // if (web3) {
        //     transfer = (await this.fixTransfer(transfer, web3)) || transfer;
        // }

        if (
            transfer.status &&
            (!this.state.transfer || (this.state.transfer.status !== transfer.status)) &&
            this.uiContainer.state.gatewayPopupID
        ) {
            await postMessageToClient(window, this.uiContainer.state.gatewayPopupID, GatewayMessageType.Status, this.getTransferStatus(transfer));
        }
        try {
            await updateStorageTransfer(renNetwork, transfer);
        } catch (error) {
            console.error(error);
        }
        await this.setState({ transfer: transfer });
    }

    public updateToAddress = async (address: string, token: Token) => {
        if (!this.state.transfer) {
            return;
        }

        const sendToken = (this.state.transfer.transferParams as LockAndMintParams | BurnAndReleaseParams).sendToken;
        const defaultToken = sendToken && (sendToken.slice(0, 3) as Token);
        const contractCalls = this.state.transfer.transferParams.contractCalls ? Array.from(this.state.transfer.transferParams.contractCalls).map(contractCall => {
            return (isFunction(contractCall) || isPromise(contractCall)) ? contractCall : contractCall.contractParams && contractCall.contractParams.map(param => {
                const match = param && typeof param.value === "string" ? param.value.match(/^__renAskForAddress__([a-zA-Z0-9]+)?$/) : null;
                try {
                    if (match && (match[1] === token || (!match[1] && token === defaultToken))) {
                        return { ...param, value: RenJS.Tokens[token].addressToHex(address) };
                    }
                } catch (error) {
                    _catchInteractionErr_(error, "Error in sdkContainer: updateToAddress, addressToHex");
                }
                return param;
            });
        }) : this.state.transfer.transferParams.contractCalls;
        if (contractCalls) {
            let partial: Partial<HistoryEvent>;
            if (this.state.transfer.eventType === EventType.LockAndMint) {
                partial = { eventType: this.state.transfer.eventType, transferParams: { ...this.state.transfer.transferParams, contractCalls } as unknown as LockAndMintEvent["transferParams"] };
            } else {
                partial = { eventType: this.state.transfer.eventType, transferParams: { ...this.state.transfer.transferParams, contractCalls } as unknown as BurnAndReleaseEvent["transferParams"] };
            }
            await this.updateTransfer(partial);
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Burn and release ////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    public submitBurnToEthereum = async (retry = false) => {
        const { sdkRenVM: renVM } = this.state;
        // const { sdkAddress: address, sdkWeb3: web3, sdkRenVM: renVM } = this.state;
        if (!renVM) {
            throw new Error(`Invalid values required for swap`);
        }
        const transfer = this.state.transfer;
        if (!transfer) {
            throw new Error("Transfer not set");
        }
        if (transfer.eventType === EventType.LockAndMint) {
            throw new Error(`Expected burn details but got mint`);
        }
        const { gatewayPopupID } = this.uiContainer.state;
        if (!gatewayPopupID) {
            throw new Error(`No gateway popup ID.`);
        }

        const params: SerializableBurnAndReleaseParams = transfer.transferParams;

        if (retry) {
            await this.updateTransfer({
                inTx: undefined,
            }, { force: true });
        }

        // if (retry) {
        //     await this.approveTokenTransfer(transferID);
        // }

        // If there's a previous transaction and `retry` isn't set, reuse tx.
        let transactionHash = transfer.inTx && transfer.inTx.chain === Chain.Ethereum && !retry ? transfer.inTx.hash : null;

        if (!transactionHash) {

            const transactionConfigs = renVM.burnAndRelease({
                ...params
            }).createTransactions();

            for (let i = 0; i < transactionConfigs.length; i++) {
                const transactionConfig = transactionConfigs[i];

                const { txHash, error: sendTransactionError } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.SendEthereumTx, { transactionConfig });
                if (sendTransactionError) {
                    throw new Error(sendTransactionError);
                }

                if (!txHash) {
                    throw new Error("No txHash returned from Web3");
                }

                if (i === transactionConfigs.length - 1) {
                    transactionHash = txHash;

                    await this.updateTransfer({
                        inTx: EthereumTx(transactionHash),
                        status: BurnAndReleaseStatus.SubmittedToEthereum,
                    });
                }

                const { error } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.GetEthereumTxStatus, { txHash });
                if (error) {
                    throw new Error(error);
                }
            }
        } else {
            const { error } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.GetEthereumTxStatus, { txHash: transactionHash });
            if (error) {
                throw new Error(error);
            }
        }

        await this.updateTransfer({
            inTx: transactionHash ? EthereumTx(transactionHash) : null,
            status: BurnAndReleaseStatus.ConfirmedOnEthereum,
        });
    }

    public submitBurnToRenVM = async (_resubmit = false) => {
        // if (resubmit) {
        //     await this.updateTransfer({ status: BurnAndReleaseStatus.ConfirmedOnEthereum, txHash: null });
        // }

        const { sdkRenVM: renVM } = this.state;
        // if (!web3) { throw new Error(`Web3 not initialized`); }
        if (!renVM) { throw new Error(`RenVM not initialized`); }

        const transfer = this.state.transfer;
        if (!transfer) { throw new Error("Transfer not set"); }
        if (!transfer.inTx || transfer.inTx.chain !== Chain.Ethereum) { throw new Error(`Must submit burn to Ethereum before RenVM.`); }

        const { gatewayPopupID } = this.uiContainer.state;
        if (!gatewayPopupID) {
            throw new Error(`No gateway popup ID.`);
        }

        const { burnReference, error: getTransactionBurnError } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.GetEthereumTxBurn, { txHash: transfer.inTx.hash });
        if (getTransactionBurnError) {
            throw new Error(getTransactionBurnError);
        }

        const burnAndReleaseObject = await renVM.burnAndRelease({
            sendToken: transfer.transferParams.sendToken,
            burnReference,
        }).readFromEthereum();

        const txHash = burnAndReleaseObject.txHash();
        this.updateTransfer({
            txHash,
            status: BurnAndReleaseStatus.SubmittedToRenVM,
        }).catch((updateTransferError) => _catchBackgroundErr_(updateTransferError, "Error in sdkContainer: submitBurnToRenVM > txHash > updateTransfer"));

        const response = await burnAndReleaseObject.submit()
            .on("status", (renVMStatus: TxStatus) => {
                this.updateTransfer({
                    renVMStatus,
                }).catch((error) => _catchBackgroundErr_(error, "Error in sdkContainer: submitBurnToRenVM > onStatus > updateTransfer"));
            });

        await this.updateTransfer({ renVMQuery: response, txHash: response.hash });

        // TODO: Fix returned types for burning
        const address = response.in.to;

        await this.updateTransfer({
            outTx: transfer.transferParams.sendToken === RenJS.Tokens.ZEC.Eth2Zec ?
                { chain: Chain.Zcash, address } :
                transfer.transferParams.sendToken === RenJS.Tokens.BCH.Eth2Bch ?
                    { chain: Chain.BitcoinCash, address } :
                    { chain: Chain.Bitcoin, address },
            status: BurnAndReleaseStatus.ReturnedFromRenVM,
        }).catch((error) => _catchBackgroundErr_(error, "Error in sdkContainer: submitBurnToRenVM > updateTransfer"));
    }

    ////////////////////////////////////////////////////////////////////////////
    // Lock and mint ///////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Minting involves the following steps:
    // 1. Generate a gateway address
    // 2. Wait for a deposit to the address
    // 3. Submit the deposit to RenVM and retrieve back a signature
    // 4. Submit the signature to Ethereum

    public lockAndMintObject = (): LockAndMint => {
        const { sdkRenVM: renVM } = this.state;
        if (!renVM) {
            throw new Error("Invalid parameters passed to `generateAddress`");
        }
        const transfer = this.state.transfer;
        if (!transfer) {
            throw new Error("Transfer not set");
        }

        return renVM.lockAndMint(transfer.transferParams as LockAndMintParams);
    }

    // Takes a transferParams as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = (): string | undefined => {
        return this
            .lockAndMintObject()
            .gatewayAddress();
    }

    // Retrieves unspent deposits at the provided address
    public waitForDeposits = async (onDeposit: (utxo: UTXOWithChain) => void) => {
        const transfer = this.state.transfer;
        if (!transfer) {
            throw new Error("Transfer not set");
        }
        const onTxHash = (txHash: string) => {

            const transferObject = this.state.transfer;
            if (!transferObject || !transferObject.txHash || transferObject.txHash !== txHash) {
                this.updateTransfer({ txHash })
                    .catch(console.error);
            }
        };
        const onStatus = (renVMStatus: TxStatus) => {
            this.updateTransfer({
                renVMStatus,
            }).catch(console.error);
        };

        const specifyUTXO = transfer.inTx && transfer.inTx.chain !== Chain.Ethereum && transfer.inTx.utxo ? {
            txHash: transfer.inTx.utxo.txHash,
            vOut: transfer.inTx.utxo.vOut
        } : undefined;

        const transaction = await this
            .lockAndMintObject()
            .wait(0, specifyUTXO);
        const promise = this
            .lockAndMintObject()
            .wait(this.getNumberOfConfirmations(transfer), specifyUTXO);
        promise.on("deposit", (utxo: UTXOWithChain) => {
            this.updateTransfer({ status: LockAndMintStatus.Deposited, inTx: utxo }).catch(error => { _catchBackgroundErr_(error, "Error in sdkContainer.tsx > waits"); });
            onDeposit(utxo);
        });
        const signaturePromise = transaction
            .submit()
            .on("txHash", onTxHash)
            .on("status", onStatus);

        // If the number of confirmations being waited for are less than RenVM's
        // default, check the transaction's status manually using queryTX.
        const defaultNumberOfConfirmations = numberOfConfirmations(transfer.transferParams.sendToken, this.state.sdkRenVM ? this.state.sdkRenVM.network : undefined);
        if (this.getNumberOfConfirmations(transfer) < defaultNumberOfConfirmations) {

            // tslint:disable-next-line: no-constant-condition
            while (true) {
                try {
                    const response = await transaction.queryTx();
                    await this.updateTransfer({ renVMQuery: response, txHash: response.hash });
                    break;
                } catch (error) {
                    // Ignore error
                }
            }

            await this.returnTransfer();
            return;
        }
        const signature = await signaturePromise;
        await this.updateTransfer({ status: LockAndMintStatus.ReturnedFromRenVM });
        const response = await signature.queryTx();
        await this.updateTransfer({ renVMQuery: response, txHash: response.hash });
    }

    public queryTransferStatus = async () => {
        const { sdkRenVM: renVM, transfer } = this.state;

        if (transfer && transfer.renVMQuery && transfer.renVMQuery.txStatus === TxStatus.TxStatusDone) {
            return transfer.renVMQuery;
        }

        if (!renVM) { throw new Error(`RenVM not initialized`); }
        if (!transfer) { throw new Error("Transfer not set"); }

        const txHash = transfer.txHash;
        if (!txHash) { throw new Error(`Invalid values required to query status`); }

        if (transfer.eventType === EventType.LockAndMint) {
            return renVM.lockAndMint({
                sendToken: transfer.transferParams.sendToken,
                txHash,
                contractCalls: [],
            }).queryTx();
        } else {
            return renVM.burnAndRelease({
                sendToken: transfer.transferParams.sendToken,
                txHash,
            }).queryTx();
        }
    }

    public submitMintToEthereum = async (retry = false) => {
        const { gatewayPopupID } = this.uiContainer.state;
        const transfer = this.state.transfer;
        if (!transfer) { throw new Error("Transfer not set"); }
        if (!gatewayPopupID) {
            throw new Error(`No gateway popup ID.`);
        }

        let transactionHash = transfer.outTx && transfer.outTx.chain === Chain.Ethereum && !retry ? transfer.outTx.hash : null;

        if (retry) {
            await this.updateTransfer({
                inTx: undefined,
            }, { force: true });
        }
        // let receipt: TransactionReceipt;

        if (!transactionHash) {

            await sleep(500);

            let transaction = this
                .lockAndMintObject();

            let signature: LockAndMint;
            if (!transfer.inTx || transfer.inTx.chain === Chain.Ethereum || !transfer.inTx.utxo || transfer.inTx.utxo.vOut === undefined) {
                transaction = await transaction
                    .wait(0);
                signature = await transaction
                    .submit();
            } else {
                signature = await transaction
                    .submit(transfer.inTx.utxo);
            }

            const transactionConfigs = signature.createTransactions();

            for (let i = 0; i < transactionConfigs.length; i++) {
                const transactionConfig = transactionConfigs[i];
                const { txHash, error: sendTransactionError } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.SendEthereumTx, { transactionConfig });
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

            // Update lockAndMint in store.
            await this.updateTransfer({
                status: LockAndMintStatus.SubmittedToEthereum,
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

        const { error: getTransactionStatusError } = await postMessageToClient(window, gatewayPopupID, GatewayMessageType.GetEthereumTxStatus, { txHash: transactionHash });
        if (getTransactionStatusError) {
            throw new Error(getTransactionStatusError);
        }

        // Update lockAndMint in store.
        await this.updateTransfer({
            outTx: EthereumTx(transactionHash),
            status: LockAndMintStatus.ConfirmedOnEthereum,
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
