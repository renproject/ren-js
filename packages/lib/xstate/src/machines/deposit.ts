import { Machine, actions, assign, send, Actor, sendParent } from "xstate";
import RenJS from "@renproject/ren";
import { GatewaySession, GatewayTransaction } from "../types/transaction";
import { LockChain, MintChain } from "@renproject/interfaces";

export interface DepositMachineContext {
    deposit: GatewayTransaction; // The deposit being tracked
    tx: GatewaySession; // The parent gateway session being acted on
    depositListenerRef?: Actor<any>; // The listener for this depoisit
    providers: any; // The blockchain api providers required for the lockchain/burnchain
    fromChainMap: {
        [key in string]: (
            context: Omit<DepositMachineContext, "deposit">
        ) => LockChain<any>;
    }; // Functions to create the "from" param;
    toChainMap: {
        [key in string]: (
            context: Omit<DepositMachineContext, "deposit">
        ) => MintChain<any>;
    }; // Functions to create the "to" param;
    sdk: RenJS;
}

// The states a deposit can be in
export interface DepositMachineSchema {
    states: {
        restoringDeposit: {}; // We are waiting for ren-js to find the deposit
        errorRestoring: {};
        restoredDeposit: {}; // renjs has found the deposit for the transaction
        srcSettling: {}; // we are waiting for the source chain to confirm the transaction
        srcConfirmed: {}; // source chain has confirmed the transaction
        accepted: {}; // renvm has accepted and signed the transaction
        claiming: {}; // the user is submitting the transaction to mint on the destination chain
        destSettling: {}; // waiting for confirmations on the destination chain
        destConfirmed: {}; // destination chain has confirmed the transaction
        completed: {}; // user has acknowledged that the transaction is completed
        rejected: {}; // user does not want to claim this deposit
    };
}

export type DepositMachineEvent =
    | { type: "NOOP" }
    | { type: "LISTENING" }
    | { type: "DETECTED" }
    | { type: "RESTORE"; data: string }
    | { type: "RESTORED"; data: string }
    | { type: "CONFIRMED" }
    | { type: "CONFIRMATION"; data: GatewayTransaction }
    | { type: "SIGNED"; data: GatewayTransaction }
    | { type: "CLAIM" }
    | { type: "REJECT" }
    | { type: "SUBMITTED"; data: GatewayTransaction }
    | { type: "ACKNOWLEDGE" };

// Statemachine that tracks individual deposits
export const depositMachine = Machine<
    DepositMachineContext,
    DepositMachineSchema,
    DepositMachineEvent
>(
    {
        id: "RenVMDepositTransaction",
        initial: "restoringDeposit",
        states: {
            errorRestoring: {},
            restoringDeposit: {
                entry: ["listenerAction"],
                on: {
                    LISTENING: {
                        actions: send(
                            (context) => {
                                // If we don't have a raw tx, we can't restore
                                if (context.deposit.rawSourceTx) {
                                    return {
                                        type: "RESTORE",
                                        data: context.deposit.rawSourceTx,
                                    };
                                } else {
                                    return { type: "NOOP" };
                                }
                            },
                            {
                                to: (context) => {
                                    // Named listener as ref does not seem to work
                                    return `${context.deposit.sourceTxHash}DepositListener`;
                                },
                            }
                        ),
                    },
                    DETECTED: [
                        {
                            target: "restoredDeposit",
                        },
                    ],
                },
            },

            restoredDeposit: {
                entry: [send("RESTORED")],
                on: {
                    RESTORED: [
                        {
                            target: "srcSettling",
                            cond: "isSrcSettling",
                        },
                        {
                            target: "srcConfirmed",
                            cond: "isSrcSettled",
                        },
                        {
                            target: "accepted",
                            cond: "isAccepted",
                        },
                        {
                            target: "destSettling",
                            cond: "isDestSettling",
                        },
                        {
                            target: "destConfirmed",
                            cond: "isDestSettled",
                        },
                    ].reverse(),
                },
            },

            srcSettling: {
                entry: send("SETTLE", {
                    to: (context) => {
                        const id = `${context.deposit.sourceTxHash}DepositListener`;
                        return id;
                    },
                }),
                on: {
                    CONFIRMED: [
                        {
                            target: "srcConfirmed",
                            actions: [
                                sendParent((ctx, _) => ({
                                    type: "DEPOSIT_UPDATE",
                                    data: ctx.deposit,
                                })),
                                assign({
                                    deposit: (context, _) => ({
                                        ...context.deposit,
                                    }),
                                }),
                            ],
                        },
                    ],
                    CONFIRMATION: [
                        {
                            actions: [
                                assign({
                                    deposit: (context, evt) => ({
                                        ...context.deposit,
                                        sourceTxConfs:
                                            evt.data?.sourceTxConfs || 0,
                                        sourceTxConfTarget:
                                            evt.data?.sourceTxConfTarget || 1,
                                    }),
                                }),
                                sendParent((ctx, evt) => ({
                                    type: "DEPOSIT_UPDATE",
                                    data: { ...ctx.deposit, ...evt.data },
                                })),
                            ],
                        },
                    ],
                },
            },
            srcConfirmed: {
                entry: send("SIGN", {
                    to: (context) =>
                        `${context.deposit.sourceTxHash}DepositListener`,
                }),
                on: {
                    SIGNED: "accepted",
                },
            },
            accepted: {
                on: {
                    CLAIM: "claiming",
                    REJECT: "rejected",
                },
            },
            claiming: {
                entry: send("MINT", {
                    to: (context) =>
                        `${context.deposit.sourceTxHash}DepositListener`,
                }),
                on: {
                    SUBMITTED: [
                        {
                            target: "destSettling",
                            actions: [
                                assign({
                                    deposit: (ctx, evt) => ({
                                        ...ctx.deposit,
                                        ...evt.data,
                                    }),
                                }),
                                sendParent((ctx, _) => ({
                                    type: "DEPOSIT_UPDATE",
                                    data: ctx.deposit,
                                })),
                            ],
                        },
                    ],
                },
            },
            destSettling: {
                invoke: {
                    id: "destConfListener",
                    src: "destConfListener",
                },
                on: {
                    CONFIRMATION: [
                        {
                            target: "destConfirmed",
                            cond: "isDestSettled",
                            actions: [
                                assign({
                                    deposit: (ctx, evt) => ({
                                        ...ctx.deposit,
                                        ...evt.data,
                                    }),
                                }),
                                sendParent((ctx, evt) => ({
                                    type: "DEPOSIT_UPDATE",
                                    data: ctx.deposit,
                                })),
                            ],
                        },
                        {
                            actions: [
                                assign({
                                    deposit: (ctx, evt) => ({
                                        ...ctx.deposit,
                                        ...evt.data,
                                    }),
                                }),
                                sendParent((ctx, evt) => ({
                                    type: "DEPOSIT_UPDATE",
                                    data: ctx.deposit,
                                })),
                            ],
                        },
                    ],
                },
            },
            destConfirmed: {
                on: {
                    ACKNOWLEDGE: "completed",
                },
            },
            rejected: {},
            completed: {
                entry: sendParent((ctx, _) => ({
                    type: "DEPOSIT_COMPLETED",
                    data: ctx.deposit,
                })),
            },
        },
    },
    {
        guards: {
            isSrcSettling: ({ deposit: { sourceTxConfs } }) =>
                (sourceTxConfs || 0) < 1,
            isSrcConfirmed: () => false,
            isSrcSettled: ({ deposit: { sourceTxConfs } }) =>
                (sourceTxConfs || 0) > 1,
            isAccepted: ({ deposit: { renSignature } }) =>
                renSignature ? true : false,
            isDestSettling: ({ deposit: { destTxHash } }) =>
                destTxHash ? true : false,
            isDestSettled: ({
                deposit: { destTxConfs },
                tx: { destConfsTarget },
            }) => (destTxConfs || 0) > (destConfsTarget || 1),
        },
    }
);
