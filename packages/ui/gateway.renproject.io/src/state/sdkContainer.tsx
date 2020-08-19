import {
    Asset,
    BurnAndReleaseStatus,
    Chain,
    EventType,
    GatewayMessageType,
    HistoryEvent,
    isAsset,
    LockAndMintEvent,
    LockAndMintParams,
    LockAndMintStatus,
    RenContract,
    SerializableBurnAndReleaseParams,
    Tx,
    TxStatus,
    UTXOWithChain,
} from "@renproject/interfaces";
import { RenNetworkDetails } from "@renproject/contracts";
import RenJS from "@renproject/ren";
import { LockAndMint } from "@renproject/ren/build/main/lockAndMint";
import {
    parseRenContract,
    resolveInToken,
    SECONDS,
    sleep,
} from "@renproject/utils";
import { useState } from "react";
import { createContainer } from "unstated-next";

import { deepCompare } from "../lib/deepCompare";
// tslint:disable-next-line: ordered-imports
import { _catchBackgroundErr_ } from "../lib/errors";
import { postMessageToClient } from "../lib/postMessage";
import { TransferContainer } from "./transferContainer";
import { UIContainer } from "./uiContainer";

const EthereumTx = (hash: string): Tx => ({
    hash,
    chain: RenJS.Chains.Ethereum,
});

export const defaultNumberOfConfirmations = (
    renContract: "BTC" | "ZEC" | "BCH" | RenContract | Asset,
    networkDetails: RenNetworkDetails,
): number => {
    const asset = isAsset(renContract)
        ? renContract
        : parseRenContract(resolveInToken(renContract)).asset;
    switch (networkDetails.name) {
        case "mainnet":
            switch (asset) {
                case Asset.BTC:
                    return 6;
                case Asset.ZEC:
                    return 24;
                case Asset.BCH:
                    return 15;
                case Asset.ETH:
                    return 30;
            }
            break;
        case "chaosnet":
        case "testnet":
            switch (asset) {
                case Asset.BTC:
                    return 2;
                case Asset.ZEC:
                    return 6;
                case Asset.BCH:
                    return 2;
                case Asset.ETH:
                    return 12;
            }
            break;
        case "devnet":
            switch (asset) {
                case Asset.BTC:
                    return 1;
                case Asset.ZEC:
                    return 3;
                case Asset.BCH:
                    return 1;
                case Asset.ETH:
                    return 6;
            }
            break;
        case "localnet":
            switch (asset) {
                case Asset.BTC:
                    return 0;
                case Asset.ZEC:
                    return 0;
                case Asset.BCH:
                    return 0;
                case Asset.ETH:
                    return 0;
            }
            break;
    }
    return 0;
};

/**
 * The SDKContainer is responsible for talking to the RenVM SDK. It stores the
 * associated state and exposes functions to interact with the SDK.
 *
 * The main two interactions are minting (trading BTC to DAI), and burning
 * (trading DAI to BTC).
 */
const useSDKContainer = () => {
    const transferContainer = TransferContainer.useContainer();
    const uiContainer = UIContainer.useContainer();

    const [renJS, setRenJS] = useState(null as null | RenJS);
    const [transfer, setTransfer] = useState(null as HistoryEvent | null);

    const connect = async (network: string): Promise<void> => {
        setRenJS(new RenJS(network));
    };

    const getNumberOfConfirmations = () => {
        const renVM = renJS;
        if (!transfer || !renVM) {
            throw new Error("Transfer not set");
        }
        const confirmations =
            transfer.eventType === EventType.LockAndMint &&
            // tslint:disable-next-line: strict-type-predicates
            transfer.transferParams.confirmations !== null &&
            transfer.transferParams.confirmations !== undefined
                ? transfer.transferParams.confirmations
                : defaultNumberOfConfirmations(
                      transfer.transferParams.sendToken,
                      renVM.network,
                  );
        return confirmations;
    };

    const getTransferStatus = () => {
        if (!transfer) {
            throw new Error("Transfer not set");
        }
        return { status: transfer.status, details: null };
    };

    const updateTransfer = async (transferIn: Partial<HistoryEvent>) => {
        const renNetwork = uiContainer.renNetwork;
        if (!renNetwork) {
            throw new Error(
                `Error trying to update transfer in storage without network being defined.`,
            );
        }
        if (!transferContainer.store) {
            throw new Error(`Transfer storage not initialized.`);
        }

        setTransfer((currentTransfer) => {
            // tslint:disable-next-line: no-object-literal-type-assertion
            const nextTransfer = {
                ...currentTransfer,
                ...transferIn,
            } as Partial<HistoryEvent>;

            if (
                nextTransfer.status &&
                (!transfer || transfer.status !== nextTransfer.status) &&
                uiContainer.gatewayPopupID
            ) {
                postMessageToClient(
                    window,
                    uiContainer.gatewayPopupID,
                    GatewayMessageType.Status,
                    { status: nextTransfer.status, details: null },
                ).catch(console.error);
            }

            try {
                if (
                    !deepCompare(transfer, nextTransfer) &&
                    uiContainer.gatewayPopupID
                ) {
                    postMessageToClient(
                        window,
                        uiContainer.gatewayPopupID,
                        GatewayMessageType.TransferUpdated,
                        { transfer: nextTransfer as HistoryEvent },
                    ).catch(console.error);
                }
            } catch (error) {
                console.error(error);
            }

            try {
                if (
                    transferContainer.store &&
                    nextTransfer.transferParams &&
                    nextTransfer.transferParams.nonce
                ) {
                    transferContainer.store.set(
                        nextTransfer.transferParams.nonce,
                        nextTransfer as HistoryEvent,
                    );
                }
            } catch (error) {
                console.error(error);
            }

            return nextTransfer as HistoryEvent;
        });
    };

    const queryTransferStatus = async () => {
        if (
            transfer &&
            transfer.renVMQuery &&
            transfer.renVMQuery.txStatus === TxStatus.TxStatusDone
        ) {
            return transfer.renVMQuery;
        }

        if (!renJS) {
            throw new Error(`RenJS not initialized`);
        }
        if (!transfer) {
            throw new Error("Transfer not set");
        }

        const txHash = transfer.txHash;
        if (!txHash) {
            throw new Error(`Invalid values required to query status`);
        }

        if (transfer.eventType === EventType.LockAndMint) {
            return renJS
                .lockAndMint({
                    sendToken: transfer.transferParams.sendToken,
                    txHash,
                    contractCalls: [],
                })
                .queryTx();
        } else {
            return renJS
                .burnAndRelease({
                    sendToken: transfer.transferParams.sendToken,
                    txHash,
                })
                .queryTx();
        }
    };

    const returnTransfer = async () => {
        if (!uiContainer.gatewayPopupID) {
            throw new Error("Can't return without transfer ID");
        }

        await updateTransfer({ returned: true });

        const response = await queryTransferStatus();

        await sleep(100);
        await postMessageToClient(
            window,
            uiContainer.gatewayPopupID,
            GatewayMessageType.Done,
            response,
        );
    };

    ////////////////////////////////////////////////////////////////////////////
    // Burn and release ////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    const submitBurnToEthereum = async (retry = false) => {
        // const { sdkAddress: address, sdkWeb3: web3, sdkRenVM: renVM } = this.state;
        if (!renJS) {
            throw new Error(`Invalid values required for swap`);
        }
        if (!transfer) {
            throw new Error("Transfer not set");
        }
        if (transfer.eventType === EventType.LockAndMint) {
            throw new Error(`Expected burn details but got mint`);
        }
        const gatewayPopupID = uiContainer.gatewayPopupID;
        if (!gatewayPopupID) {
            throw new Error(`No gateway popup ID.`);
        }

        const params: SerializableBurnAndReleaseParams =
            transfer.transferParams;

        if (retry) {
            await updateTransfer({
                inTx: undefined,
            });
        }

        // if (retry) {
        //     await this.approveTokenTransfer(transferID);
        // }

        // If there's a previous transaction and `retry` isn't set, reuse tx.
        let transactionHash =
            transfer.inTx && transfer.inTx.chain === Chain.Ethereum && !retry
                ? transfer.inTx.hash
                : null;

        if (!transactionHash) {
            const transactionConfigs = renJS
                .burnAndRelease({
                    ...params,
                })
                .createTransactions();

            for (let i = 0; i < transactionConfigs.length; i++) {
                const transactionConfig = transactionConfigs[i];

                const {
                    txHash,
                    error: sendTransactionError,
                } = await postMessageToClient(
                    window,
                    gatewayPopupID,
                    GatewayMessageType.SendEthereumTx,
                    { transactionConfig },
                );
                if (sendTransactionError) {
                    throw new Error(sendTransactionError);
                }

                if (!txHash) {
                    throw new Error("No txHash returned from Web3");
                }

                if (i === transactionConfigs.length - 1) {
                    transactionHash = txHash;

                    await updateTransfer({
                        inTx: EthereumTx(transactionHash),
                        status: BurnAndReleaseStatus.SubmittedToEthereum,
                    });
                }

                const { error } = await postMessageToClient(
                    window,
                    gatewayPopupID,
                    GatewayMessageType.GetEthereumTxStatus,
                    { txHash },
                );
                if (error) {
                    throw new Error(error);
                }
            }
        }

        // transactionHash should not be null, but lets TypeScript know that.
        if (!transactionHash) {
            throw new Error("Error setting transaction hash.");
        }

        let ethereumConfirmations = 0;
        const confirmationsRequired = defaultNumberOfConfirmations(
            Asset.ETH,
            renJS.network,
        );
        while (ethereumConfirmations < confirmationsRequired) {
            const {
                error,
                confirmations,
                reverted,
            } = await postMessageToClient(
                window,
                gatewayPopupID,
                GatewayMessageType.GetEthereumTxStatus,
                { txHash: transactionHash },
            );
            if (error) {
                if (error.match(/Transaction was reverted/)) {
                    throw new Error(error);
                }
                // May be network error.
                console.error(error);
            }

            // Backwards compatibility check - old versions of
            // @renproject/gateway always return `0` for the number of
            // confirmations, and don't return the `reverted` flag.
            if ((reverted as boolean | undefined) === undefined) {
                break;
            }

            if (confirmations) {
                ethereumConfirmations = confirmations;
                const previousConfirmations =
                    transfer &&
                    transfer.eventType === EventType.BurnAndRelease &&
                    transfer.ethereumConfirmations !== undefined
                        ? transfer.ethereumConfirmations
                        : 0;
                await updateTransfer({
                    ethereumConfirmations: Math.max(
                        ethereumConfirmations,
                        previousConfirmations,
                    ),
                });
            }
            await sleep(10 * SECONDS);
        }

        await updateTransfer({
            inTx: transactionHash ? EthereumTx(transactionHash) : null,
            status: BurnAndReleaseStatus.ConfirmedOnEthereum,
        });
    };

    const submitBurnToRenVM = async (_resubmit = false) => {
        // if (resubmit) {
        //     await updateTransfer({ status: BurnAndReleaseStatus.ConfirmedOnEthereum, txHash: null });
        // }

        // if (!web3) { throw new Error(`Web3 not initialized`); }
        if (!renJS) {
            throw new Error(`RenVM not initialized`);
        }

        if (!transfer) {
            throw new Error("Transfer not set");
        }
        if (!transfer.inTx || transfer.inTx.chain !== Chain.Ethereum) {
            throw new Error(`Must submit burn to Ethereum before RenVM.`);
        }

        const gatewayPopupID = uiContainer.gatewayPopupID;
        if (!gatewayPopupID) {
            throw new Error(`No gateway popup ID.`);
        }

        const {
            burnReference,
            error: getTransactionBurnError,
        } = await postMessageToClient(
            window,
            gatewayPopupID,
            GatewayMessageType.GetEthereumTxBurn,
            { txHash: transfer.inTx.hash },
        );
        if (getTransactionBurnError) {
            throw new Error(getTransactionBurnError);
        }

        const burnAndReleaseObject = await renJS
            .burnAndRelease({
                sendToken: transfer.transferParams.sendToken,
                burnReference,
            })
            .readFromEthereum();

        const txHash = burnAndReleaseObject.txHash();
        updateTransfer({
            txHash,
            status: BurnAndReleaseStatus.SubmittedToRenVM,
        }).catch((updateTransferError) => {
            _catchBackgroundErr_(
                updateTransferError,
                "Error in sdkContainer: submitBurnToRenVM > txHash > updateTransfer",
            );
        });

        const response = await burnAndReleaseObject
            .submit()
            .on("status", (renVMStatus: TxStatus) => {
                updateTransfer({
                    renVMStatus,
                }).catch((error) => {
                    _catchBackgroundErr_(
                        error,
                        "Error in sdkContainer: submitBurnToRenVM > onStatus > updateTransfer",
                    );
                });
            });

        await updateTransfer({ renVMQuery: response, txHash: response.hash });

        // TODO: Fix returned types for burning
        const address = response.in.to;

        await updateTransfer({
            outTx:
                transfer.transferParams.sendToken === RenJS.Tokens.ZEC.Eth2Zec
                    ? { chain: Chain.Zcash, address }
                    : transfer.transferParams.sendToken ===
                      RenJS.Tokens.BCH.Eth2Bch
                    ? { chain: Chain.BitcoinCash, address }
                    : { chain: Chain.Bitcoin, address },
            status: BurnAndReleaseStatus.ReturnedFromRenVM,
        }).catch((error) => {
            _catchBackgroundErr_(
                error,
                "Error in sdkContainer: submitBurnToRenVM > updateTransfer",
            );
        });
    };

    ////////////////////////////////////////////////////////////////////////////
    // Lock and mint ///////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Minting involves the following steps:
    // 1. Generate a gateway address
    // 2. Wait for a deposit to the address
    // 3. Submit the deposit to RenVM and retrieve back a signature
    // 4. Submit the signature to Ethereum

    const lockAndMintObject = (): LockAndMint => {
        if (!renJS) {
            throw new Error("Invalid parameters passed to `lockAndMintObject`");
        }
        if (!transfer) {
            throw new Error("Transfer not set");
        }

        const params = transfer.transferParams as LockAndMintParams;
        const inTx =
            transfer.inTx &&
            transfer.inTx.chain !== Chain.Ethereum &&
            transfer.inTx.utxo
                ? transfer.inTx.utxo
                : undefined;

        return renJS.lockAndMint({
            ...params,
            deposit: params.deposit || inTx,
        });
    };

    // Takes a transferParams as bytes or an array of primitive types and returns
    // the deposit address
    const generateAddress = async (): Promise<string | undefined> => {
        if (!transfer || transfer.eventType === EventType.BurnAndRelease) {
            throw new Error("Invalid parameters passed to `generateAddress`");
        }

        if (transfer.gatewayAddress) {
            return transfer.gatewayAddress;
        }

        const address = await lockAndMintObject().gatewayAddress();

        const update: Partial<LockAndMintEvent> = {
            gatewayAddress: address,
            transferParams: {
                ...transfer.transferParams,
                gatewayAddress: address,
            },
        };
        await updateTransfer(update);

        return address;
    };

    // Retrieves unspent deposits at the provided address
    const waitForDeposits = async (
        onDeposit: (utxo: UTXOWithChain) => void,
    ) => {
        if (!transfer || !renJS) {
            throw new Error("Transfer not set");
        }
        const onTxHash = (txHash: string) => {
            const transferObject = transfer;
            if (
                !transferObject ||
                !transferObject.txHash ||
                transferObject.txHash !== txHash
            ) {
                updateTransfer({ txHash }).catch(console.error);
            }
        };
        const onStatus = (renVMStatus: TxStatus) => {
            updateTransfer({
                renVMStatus,
            }).catch(console.error);
        };

        const specifyUTXO =
            transfer.inTx &&
            transfer.inTx.chain !== Chain.Ethereum &&
            transfer.inTx.utxo
                ? {
                      txHash: transfer.inTx.utxo.txHash,
                      vOut: transfer.inTx.utxo.vOut,
                  }
                : undefined;

        const transaction = await lockAndMintObject().wait(0, specifyUTXO);
        const promise = lockAndMintObject().wait(
            getNumberOfConfirmations(),
            specifyUTXO,
        );
        promise.on("deposit", (utxo: UTXOWithChain) => {
            // tslint:disable-next-line: strict-type-predicates
            if (utxo.utxo && utxo.utxo.vOut !== undefined) {
                updateTransfer({
                    status: LockAndMintStatus.Deposited,
                    inTx: utxo,
                }).catch((error) => {
                    _catchBackgroundErr_(
                        error,
                        "Error in sdkContainer.tsx > waits",
                    );
                });
                onDeposit(utxo);
            }
        });
        const signaturePromise = transaction
            .submit()
            .on("txHash", onTxHash)
            .on("status", onStatus);

        // If the number of confirmations being waited for are less than RenVM's
        // default, check the transaction's status manually using queryTX.
        const defaultConfirmations = defaultNumberOfConfirmations(
            transfer.transferParams.sendToken,
            renJS.network,
        );
        if (getNumberOfConfirmations() < defaultConfirmations) {
            // tslint:disable-next-line: no-constant-condition
            while (true) {
                try {
                    const renVMQuery = await transaction.queryTx();
                    await updateTransfer({
                        renVMQuery,
                        txHash: renVMQuery.hash,
                    });
                    break;
                } catch (error) {
                    // Ignore error
                }
            }

            await returnTransfer();
            return;
        }
        const signature = await signaturePromise;
        await updateTransfer({ status: LockAndMintStatus.ReturnedFromRenVM });
        const response = await signature.queryTx();
        await updateTransfer({ renVMQuery: response, txHash: response.hash });
    };

    const submitMintToEthereum = async (retry = false) => {
        const gatewayPopupID = uiContainer.gatewayPopupID;
        if (!transfer) {
            throw new Error("Transfer not set");
        }
        if (transfer.eventType !== EventType.LockAndMint) {
            throw new Error(`Expected mint object, got ${transfer.eventType}`);
        }
        if (!gatewayPopupID) {
            throw new Error(`No gateway popup ID.`);
        }

        let transactionHash =
            transfer.outTx && transfer.outTx.chain === Chain.Ethereum && !retry
                ? transfer.outTx.hash
                : null;

        if (retry) {
            await updateTransfer({
                outTx: undefined,
            });
        }
        // let receipt: TransactionReceipt;

        if (!transactionHash && transfer.renVMQuery) {
            const sigHash = transfer.renVMQuery.autogen.sighash;
            const token = resolveInToken(transfer.transferParams.sendToken);
            try {
                const {
                    txHash,
                    error: findMinTransactionError,
                } = await postMessageToClient(
                    window,
                    gatewayPopupID,
                    GatewayMessageType.FindMintTransaction,
                    { sigHash, token },
                );
                if (txHash) {
                    transactionHash = txHash;
                }
                if (findMinTransactionError) {
                    console.error(findMinTransactionError);
                }
            } catch (error) {
                console.error(error);
            }
        }

        if (!transactionHash) {
            await sleep(500);

            // tslint:disable-next-line: strict-type-predicates
            if (
                !transfer.inTx ||
                transfer.inTx.chain === Chain.Ethereum ||
                !transfer.inTx.utxo ||
                transfer.inTx.utxo.vOut === undefined
            ) {
                await updateTransfer({
                    status: LockAndMintStatus.Committed,
                });
                return;
            }

            const signature = await lockAndMintObject().submit(
                transfer.inTx.utxo,
            );

            const transactionConfigs = signature.createTransactions();

            for (let i = 0; i < transactionConfigs.length; i++) {
                const transactionConfig = transactionConfigs[i];
                const {
                    txHash,
                    error: sendTransactionError,
                } = await postMessageToClient(
                    window,
                    gatewayPopupID,
                    GatewayMessageType.SendEthereumTx,
                    { transactionConfig },
                );
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

            // Update lockAndMint in store.
            await updateTransfer({
                status: LockAndMintStatus.SubmittedToEthereum,
                outTx: EthereumTx(transactionHash),
            });
        }

        const {
            error: getTransactionStatusError,
        } = await postMessageToClient(
            window,
            gatewayPopupID,
            GatewayMessageType.GetEthereumTxStatus,
            { txHash: transactionHash },
        );
        if (getTransactionStatusError) {
            throw new Error(getTransactionStatusError);
        }

        // Update lockAndMint in store.
        await updateTransfer({
            outTx: EthereumTx(transactionHash),
            status: LockAndMintStatus.ConfirmedOnEthereum,
        });

        return;
    };

    const canClearMintTransaction = () => {
        return (
            transfer &&
            transfer.eventType === EventType.LockAndMint &&
            transfer.status === LockAndMintStatus.SubmittedToEthereum &&
            transfer.outTx
        );
    };

    /**
     * Clear a pending mint transaction. This can only be done for mints.
     * If the transaction does eventually go through, it will be detected.
     */
    const clearMintTransaction = async () => {
        // Check that the mint tx can/should be cleared.
        if (!canClearMintTransaction()) {
            return;
        }

        // Clear mint tx.
        await updateTransfer({
            status: LockAndMintStatus.ReturnedFromRenVM,
            outTx: undefined,
            txHash: undefined,
        });
    };

    const canClearLockTransaction = () => {
        return (
            transfer &&
            transfer.eventType === EventType.LockAndMint &&
            transfer.status === LockAndMintStatus.Deposited &&
            transfer.inTx &&
            transfer.inTx.chain !== Chain.Ethereum &&
            // Check that tx has 0 confirmations
            (!transfer.inTx.utxo || transfer.inTx.utxo.confirmations === 0)
        );
    };

    const clearLockTransaction = async () => {
        // Check that the lock tx can/should be cleared.
        if (!canClearLockTransaction()) {
            return;
        }

        // Clear lock tx.
        await updateTransfer({
            status: LockAndMintStatus.Committed,
            inTx: undefined,
        });
    };

    return {
        renJS,
        transfer,
        connect,
        getNumberOfConfirmations,
        getTransferStatus,
        returnTransfer,
        updateTransfer,
        submitBurnToEthereum,
        submitBurnToRenVM,
        lockAndMintObject,
        generateAddress,
        waitForDeposits,
        queryTransferStatus,
        submitMintToEthereum,
        canClearMintTransaction,
        clearMintTransaction,
        canClearLockTransaction,
        clearLockTransaction,
    };
};

export const SDKContainer = createContainer(useSDKContainer);
