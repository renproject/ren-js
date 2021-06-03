/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import { DepositCommon, LockAndMintTransaction } from "@renproject/interfaces";
import {
    DepositStatus,
    LockAndMint,
    LockAndMintDeposit,
} from "@renproject/ren/build/main/lockAndMint";
import {
    Actor,
    assign,
    MachineOptions,
    Receiver,
    Sender,
    spawn,
    send,
    actions,
} from "xstate";
import { TransactionReceipt } from "web3-core";

import {
    buildDepositMachine,
    DepositMachineContext,
    DepositMachineEvent,
} from "../machines/deposit";
import { GatewayMachineContext, GatewayMachineEvent } from "../machines/mint";
import {
    AcceptedGatewayTransaction,
    AllGatewayTransactions,
    CompletedGatewayTransaction,
    ConfirmingGatewayTransaction,
    GatewayTransaction,
    isConfirming,
    isOpen,
    MintedGatewayTransaction,
    OpenedGatewaySession,
} from "../types/mint";

// Recursively cast all buffers in an object to hex
const hexify = (obj: { [key: string]: any }) => {
    if (!obj) return;
    const entries = Object.entries(obj);
    for (const [k, v] of entries) {
        if (Buffer.isBuffer(v)) {
            obj[k] = v.toString("hex");
        }
    }
    return obj;
};

// Create a LockAndMint instance from a RenTX context
export const renLockAndMint = async <X>(context: GatewayMachineContext<X>) => {
    const { nonce, sourceAsset } = context.tx;
    const { sdk, to, from } = context;

    const mint = await sdk.lockAndMint({
        asset: sourceAsset.toUpperCase(),
        from: from(context),
        to: to(context),
        nonce,
    });

    return mint;
};

// FIXME: These should exist at the RenJS level (gateway validity estimate)
const getSessionDay = () => Math.floor(Date.now() / 1000 / 60 / 60 / 24);
// const getSessionExpiry = () => (getSessionDay() + 3) * 60 * 60 * 24 * 1000;

// Format a transaction and get the gateway address
const txCreator = async <X>(context: GatewayMachineContext<X>) => {
    // If no nonce is provided, mock the behavior of a new gateway every day
    if (!context.tx.nonce) {
        const nonce = getSessionDay();
        context.tx.nonce = Buffer.from(
            nonce.toString(16).padStart(32),
        ).toString("hex");
    }

    const minter = await renLockAndMint(context);
    const gatewayAddress = minter?.gatewayAddress;
    const newTx: OpenedGatewaySession<X> = {
        ...context.tx,
        gatewayAddress,
    };
    return newTx;
};

const initMinter = async <X>(
    context: GatewayMachineContext<X>,
    callback: Sender<GatewayMachineEvent<X>>,
) => {
    const minter = await renLockAndMint(context);

    if (
        isOpen(context.tx) &&
        minter.gatewayAddress != context.tx.gatewayAddress
    ) {
        callback({
            type: "ERROR_LISTENING",
            data: new Error(
                `Incorrect gateway address ${String(
                    minter.gatewayAddress,
                )} != ${context.tx.gatewayAddress}`,
            ),
        });
    }
    return minter;
};

const handleSettle = async <X>(
    sourceTxHash: string,
    deposit: LockAndMintDeposit,
    callback: Sender<DepositMachineEvent<X>>,
) => {
    try {
        const res = await deposit
            .confirmed()
            .on("target", (targetConfs) => {
                const confirmedTx = {
                    sourceTxHash,
                    sourceTxConfs: 0,
                    sourceTxConfTarget: targetConfs,
                };
                callback({
                    type: "CONFIRMATION",
                    data: confirmedTx,
                });
            })
            .on("confirmation", (confs, targetConfs) => {
                const confirmedTx = {
                    sourceTxHash,
                    sourceTxConfs: confs,
                    sourceTxConfTarget: targetConfs,
                };
                callback({
                    type: "CONFIRMATION",
                    data: confirmedTx,
                });
            });

        callback({
            type: "CONFIRMED",
            data: {
                sourceTxConfTarget: res._state.targetConfirmations,
                sourceTxConfs: res._state.targetConfirmations,
                sourceTxHash,
            },
        });
    } catch (e) {
        callback({
            type: "ERROR",
            data: {
                sourceTxHash,
            },
            error: e,
        });
    }
};

// Handle signing on RenVM
const handleSign = async <X>(
    tx: ConfirmingGatewayTransaction<X>,
    deposit: LockAndMintDeposit,
    callback: Sender<DepositMachineEvent<X>>,
) => {
    try {
        const v = await deposit.signed();
        // TODO: handle status? .on("status", (state) => {});

        if (!v._state.queryTxResult || !v._state.queryTxResult.out) {
            callback({
                type: "SIGN_ERROR",
                data: {
                    ...tx,
                },
                error: new Error("No signature!"),
            });
            return;
        }
        if (
            (v._state.queryTxResult.out &&
                v._state.queryTxResult.out.revert !== undefined) ||
            v.revertReason
        ) {
            callback({
                type: "REVERTED",
                data: {
                    ...tx,
                },
                error: new Error(
                    v._state.queryTxResult.out.revert?.toString() ||
                        v.revertReason ||
                        "unknown",
                ),
            });
            return;
        } else {
            const data: AcceptedGatewayTransaction<X> = {
                ...tx,
                renResponse: hexify(
                    v._state.queryTxResult.out,
                ) as LockAndMintTransaction,
                renSignature: v._state.queryTxResult.out.signature?.toString(
                    "hex",
                ),
            };
            callback({
                type: "SIGNED",
                data,
            });
        }
    } catch (e) {
        // If error was due to revert - enter reverted state
        if (deposit.revertReason) {
            callback({
                type: "REVERTED",
                data: {
                    ...tx,
                },
                error: new Error(deposit.revertReason),
            });
            return;
        }

        // If a tx has already been minted, we will get an error at this step
        // We can assume that a "utxo spent" error implies that the asset has been minted
        callback({
            type: "SIGN_ERROR",
            data: tx,

            // Error must be stringified because full log breaks xstate serialization
            error: e,
        });
    }
};

// Handle minting on destination chain
const handleMint = async <X, Y extends { [name: string]: unknown }>(
    sourceTxHash: string,
    deposit: LockAndMintDeposit,
    callback: Sender<DepositMachineEvent<X>>,
    params?: Y,
) => {
    try {
        const minter = deposit.mint(params);

        const onConfirmation = (_: void, receipt: TransactionReceipt) => {
            const submittedTx = {
                sourceTxHash,
            };
            if (receipt.status == false) {
                callback({
                    type: "SUBMIT_ERROR",
                    data: { sourceTxHash },
                    error: new Error("Transaction was reverted"),
                });
            } else {
                callback({
                    type: "ACKNOWLEDGE",
                    data: submittedTx,
                });
            }

            // only acknowledge once
            minter.removeListener("confirmation", onConfirmation);
        };

        await minter.on("transactionHash", (transactionHash) => {
            const submittedTx = {
                sourceTxHash,
                destTxHash: transactionHash,
            };
            callback({
                type: "SUBMITTED",
                data: submittedTx,
            });
        });

        await minter.on("confirmation", onConfirmation);
        await minter;
    } catch (e) {
        callback({
            type: "SUBMIT_ERROR",
            data: { sourceTxHash },
            error: e,
        });
    }
};

const resolveDeposit = <X extends { confirmations?: string }>(
    hash: string,
    deposit: LockAndMintDeposit<X>,
) => {
    const rawSourceTx = deposit.depositDetails; // as DepositCommon<>;
    const newDepositState: GatewayTransaction<X> = {
        sourceTxHash: hash,
        renVMHash: deposit.txHash(),
        sourceTxAmount: rawSourceTx.amount,
        sourceTxConfs: parseInt(rawSourceTx.transaction.confirmations || "0"),
        rawSourceTx,
        detectedAt: new Date().getTime(),
    };

    if (!deposit._state.queryTxResult || !deposit._state.queryTxResult.out) {
        return newDepositState;
    } else {
        if (deposit._state.queryTxResult.out?.revert) {
            newDepositState.error = new Error(
                deposit._state.queryTxResult.out?.revert.toString(),
            );
            return newDepositState;
        } else {
            // only accepted if the queryTxResult has an "out" field
            const acceptedData: AcceptedGatewayTransaction<X> = {
                ...newDepositState,
                sourceTxConfTarget:
                    deposit._state.targetConfirmations ??
                    newDepositState.sourceTxConfs,
                renResponse: hexify(
                    deposit._state.queryTxResult || {},
                ) as LockAndMintTransaction,
                renSignature: deposit._state.queryTxResult.out?.signature,
            };

            if (deposit.status === DepositStatus.Submitted) {
                const data: CompletedGatewayTransaction<X> = {
                    ...acceptedData,
                    destTxAmount:
                        deposit._state.queryTxResult.out?.amount || "0",
                    rawDestTx: {},
                    contractParams: {},
                    // we don't actually know when the tx completed,
                    // so assume it is now
                    completedAt: Date.now(),
                    destTxHash: deposit.mintTransaction,
                };
                return data;
            } else {
                return acceptedData;
            }
        }
    }
};

const mintFlow = <X>(
    context: GatewayMachineContext<X>,
    callback: Sender<GatewayMachineEvent<X>>,
    receive: Receiver<any>,
    minter: LockAndMint<X, DepositCommon<X>, any, any, any>,
) => {
    // Transactions that we have resolved
    const detectedTransactions = new Map<string, AllGatewayTransactions<X>>();
    const restoredDeposits = new Map<string, LockAndMintDeposit>();

    const depositHandler = (deposit: LockAndMintDeposit) => {
        const txHash = deposit.params.from.transactionID(
            deposit.depositDetails.transaction,
        );

        const restored = restoredDeposits.get(txHash);
        // if we have previously restored the deposit,
        // don't emit an event
        if (restored) {
            return;
        }

        const persistedTx =
            context.tx.transactions[txHash] || detectedTransactions.get(txHash);

        if (persistedTx) {
            restoredDeposits.set(txHash, deposit);
            detectedTransactions.set(txHash, persistedTx);
            let data = persistedTx;

            if (deposit.status === DepositStatus.Submitted) {
                const completedTx: CompletedGatewayTransaction<X> = {
                    ...(persistedTx as MintedGatewayTransaction<X>),
                    destTxHash: deposit.mintTransaction,
                    completedAt: Date.now(),
                };
                data = completedTx;
            }
            return callback({ type: "RESTORED", data });
        }

        const resolved = resolveDeposit(txHash, deposit);
        detectedTransactions.set(txHash, resolved);

        callback({
            type: "DEPOSIT",
            data: resolved,
        });
    };

    minter.on("deposit", depositHandler);

    receive((event) => {
        const deposit = restoredDeposits.get(event.hash);
        if (!deposit) return;
        const tx = detectedTransactions.get(event.hash);
        if (!tx || !isConfirming(tx)) {
            callback({
                type: "ERROR",
                data: event.data,
                error: new Error(`Invalid deposit: ${String(event.hash)}`),
            });
            return;
        }

        const handle = async () => {
            switch (event.type) {
                case "UPDATE":
                    detectedTransactions.set(event.hash, event.data);
                    break;
                case "SETTLE":
                    await handleSettle(event.hash, deposit, callback);
                    break;
                case "SIGN":
                    await handleSign(tx, deposit, callback);
                    break;
                case "MINT":
                    await handleMint(
                        event.hash,
                        deposit,
                        callback,
                        event.params,
                    );
                    break;
            }
        };

        handle()
            .then()
            .catch((e) => {
                console.error(e, event.data);
                callback({
                    type: "ERROR",
                    data: event.data,
                    error: e,
                });
            });
    });

    receive((event) => {
        switch (event.type) {
            case "RESTORE":
                minter
                    .processDeposit(event.data.rawSourceTx)
                    .then((r) => {
                        // Previously the on('deposit') event would have fired when restoring
                        // Now, we use the promise result to set up the handler as well in
                        // case the `deposit` event does not fire
                        depositHandler(r);
                    })
                    .catch((e) => {
                        callback({
                            type: "ERROR",
                            data: event.data,
                            error: e,
                        });
                    });
                break;
        }
    });
};

// Listen for confirmations on the source chain
const depositListener = <X>(context: GatewayMachineContext<X>) => (
    callback: Sender<GatewayMachineEvent<X>>,
    receive: Receiver<any>,
) => {
    let cleanup = () => {};

    initMinter(context, callback)
        .then((minter) => {
            cleanup = () => minter.removeAllListeners();
            mintFlow(context, callback, receive, minter);
            callback({ type: "LISTENING" });
        })
        .catch((e) => {
            callback({ type: "ERROR_LISTENING", data: e });
        });

    return () => {
        cleanup();
    };
};

// Spawn an actor that will listen for either all deposits to a gatewayAddress,
// or to a single deposit if present in the context
const listenerAction = assign<GatewayMachineContext<any>>({
    depositListenerRef: (c: GatewayMachineContext<any>, _e: any) => {
        const actorName = `${c.tx.id}SessionListener`;
        if (c.depositListenerRef) {
            console.warn("listener already exists");
            return c.depositListenerRef;
        }
        const cb = depositListener(c);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        return spawn(cb, actorName) as Actor<any>;
    },
});

const spawnDepositMachine = <X>(
    machineContext: DepositMachineContext<AllGatewayTransactions<X>>,
    name: string,
) =>
    spawn(
        buildDepositMachine<X>()
            .withContext(machineContext)
            .withConfig({
                actions: {
                    listenerAction: listenerAction as any,
                },
            }),
        {
            // sync: true,
            name,
        },
    );

export const buildMintConfig = <X>(): Partial<
    MachineOptions<GatewayMachineContext<X>, any>
> => ({
    services: {
        txCreator,
        depositListener,
    },
    actions: {
        broadcast: actions.pure((ctx, event) => {
            return Object.values(ctx.depositMachines || {}).map((m) =>
                send(event, { to: m.id }),
            );
        }),

        forwardEvent: send(
            (_, b) => {
                return b;
            },
            {
                to: (_ctx: GatewayMachineContext<X>) => "depositListener",
            },
        ),

        routeEvent: send(
            (_, b) => {
                return b;
            },
            {
                to: (
                    ctx: GatewayMachineContext<X>,
                    evt: { type: string; data?: { sourceTxHash?: string } },
                ) => {
                    const machines = ctx.depositMachines || {};
                    if (!evt.data)
                        throw new Error("missing data" + JSON.stringify(evt));
                    return (
                        machines[evt.data?.sourceTxHash || ""]?.id || "missing"
                    );
                },
            },
        ),

        spawnDepositMachine: assign({
            depositMachines: (context, evt) => {
                const machines = context.depositMachines || {};
                if (machines[evt.data?.sourceTxHash || ""] || !evt.data) {
                    return machines;
                }

                const newMachines: typeof machines = {};
                for (const machine of Object.entries(machines)) {
                    newMachines[machine[0]] = machine[1];
                }
                newMachines[evt.data.sourceTxHash] = spawnDepositMachine(
                    { deposit: evt.data },
                    String(evt.data.sourceTxHash),
                );
                return newMachines;
            },
        }),

        depositMachineSpawner: assign({
            depositMachines: (context, _) => {
                const machines: typeof context.depositMachines = {};
                for (const tx of Object.entries(
                    context.tx.transactions || {},
                )) {
                    const machineContext = {
                        deposit: tx[1],
                    };

                    machines[tx[0]] = spawnDepositMachine(
                        machineContext,
                        machineContext.deposit.sourceTxHash,
                    );
                }
                return { ...machines, ...context.depositMachines };
            },
        }),
        listenerAction: listenerAction, // as any
    },
});
