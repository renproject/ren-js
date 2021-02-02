/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import { assign, Machine, send, sendParent } from "xstate";
import { createModel } from "xstate/lib/model";
import { log } from "xstate/lib/actions";
import { assert } from "@renproject/utils";

import { GatewayTransaction } from "../types/transaction";

/** The context that the deposit machine acts on */
export interface DepositMachineContext {
    /** The deposit being tracked */
    deposit: GatewayTransaction;
}

/** The states a deposit can be in */
export interface DepositMachineSchema {
    states: {
        /** check if we can skip instantiating the deposit, if we finished the tx
         * previously  */
        checkingCompletion: {};
        /** We are waiting for ren-js to find the deposit */
        restoringDeposit: {};
        /** We couldn't restore this deposit */
        errorRestoring: {};
        /** renjs has found the deposit for the transaction */
        restoredDeposit: {};
        /** we are waiting for the source chain to confirm the transaction */
        srcSettling: {};
        /** source chain has confirmed the transaction */
        srcConfirmed: {};
        /** renvm has accepted and signed the transaction */
        accepted: {};
        /** renvm did not accept the tx */
        errorAccepting: {};
        /** the user is submitting the transaction to mint on the destination chain */
        claiming: {};
        /** there was an error submitting the tx to the destination chain */
        errorSubmitting: {};
        /** We have recieved a txHash for the destination chain */
        destInitiated: {};
        /** user has acknowledged that the transaction is completed, so we can stop listening for further deposits */
        completed: {};
        /** user does not want to claim this deposit */
        rejected: {};
    };
}

interface ContractParams {
    [key: string]: any;
}

export type DepositMachineEvent =
    | { type: "NOOP" }
    | { type: "CHECK" }
    | { type: "LISTENING" }
    | { type: "DETECTED" }
    | { type: "ERROR"; data: GatewayTransaction; error: Error }
    | { type: "RESTORE"; data: GatewayTransaction }
    | { type: "RESTORED"; data: GatewayTransaction }
    | { type: "CONFIRMED" }
    | { type: "CONFIRMATION"; data: GatewayTransaction }
    | { type: "SIGNED"; data: GatewayTransaction }
    | { type: "SIGN_ERROR"; data: Error }
    | { type: "CLAIM"; data: ContractParams }
    | { type: "REJECT" }
    | { type: "SUBMITTED"; data: GatewayTransaction }
    | { type: "SUBMIT_ERROR"; data: Error }
    | { type: "ACKNOWLEDGE" };

const depositModel = createModel<DepositMachineContext, DepositMachineEvent>({
    deposit: {
        sourceTxConfs: 0,
        sourceTxHash: "",
        sourceTxAmount: 0,
        rawSourceTx: { amount: "0", transaction: {} },
    },
});

/** Statemachine that tracks individual deposits */
export const depositMachine = Machine<
    DepositMachineContext,
    DepositMachineSchema,
    DepositMachineEvent
>(
    {
        id: "RenVMDepositTransaction",
        context: depositModel.initialContext,
        initial: "checkingCompletion",
        states: {
            // Checking if deposit is completed so that we can skip initialization
            checkingCompletion: {
                entry: [send("CHECK")],

                // If we already have a dest hash, no need to listen
                on: {
                    CHECK: [
                        {
                            target: "destInitiated",
                            cond: "isDestInitiated",
                        },
                        { target: "restoringDeposit" },
                    ],
                },

                meta: {
                    test: (_: void, state: any) => {
                        assert(
                            !state.context.deposit.error ? true : false,
                            "Error must not exist",
                        );
                    },
                },
            },
            errorRestoring: {
                entry: [log((ctx, _) => ctx.deposit.error, "ERROR")],
                meta: {
                    test: (_: void, state: any) => {
                        assert(
                            state.context.deposit.error ? true : false,
                            "Error must exist",
                        );
                    },
                },
            },

            restoringDeposit: {
                entry: sendParent((c, _) => ({
                    type: "RESTORE",
                    data: c.deposit,
                })),

                on: {
                    RESTORED: {
                        target: "restoredDeposit",
                        actions: assign((_, e) => ({ deposit: e.data })),
                    },
                    ERROR: {
                        target: "errorRestoring",
                        actions: assign((c, e) => ({
                            deposit: { ...c.deposit, error: e.error },
                        })),
                    },
                },

                meta: {
                    test: (_: void, state: any) => {
                        assert(
                            !state.context.deposit.error ? true : false,
                            "Error must not exist",
                        );
                    },
                },
            },

            // Checking deposit internal state to transition to correct machine state
            restoredDeposit: {
                // Parent must send restored
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
                            target: "destInitiated",
                            cond: "isDestInitiated",
                        },
                    ].reverse(),
                },
                meta: { test: async () => {} },
            },

            srcSettling: {
                entry: sendParent((ctx, _) => ({
                    type: "SETTLE",
                    hash: ctx.deposit.sourceTxHash,
                })),
                on: {
                    CONFIRMED: [
                        {
                            target: "srcConfirmed",
                            actions: [
                                sendParent((ctx, _) => {
                                    return {
                                        type: "DEPOSIT_UPDATE",
                                        data: ctx.deposit,
                                    };
                                }),
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
                                sendParent((ctx, evt) => ({
                                    type: "DEPOSIT_UPDATE",
                                    data: { ...ctx.deposit, ...evt.data },
                                })),
                                assign({
                                    deposit: (context, evt) => ({
                                        ...context.deposit,
                                        sourceTxConfs:
                                            evt.data?.sourceTxConfs || 0,
                                        sourceTxConfTarget:
                                            evt.data?.sourceTxConfTarget || 1,
                                    }),
                                }),
                            ],
                        },
                    ],

                    ERROR: [
                        {
                            actions: [
                                assign({
                                    deposit: (ctx, evt) => ({
                                        ...ctx.deposit,
                                        error: evt.error,
                                    }),
                                }),
                                log((ctx, _) => ctx.deposit.error, "ERROR"),
                            ],
                        },
                    ],
                },
                meta: { test: async () => {} },
            },

            srcConfirmed: {
                entry: sendParent((ctx, _) => ({
                    type: "SIGN",
                    hash: ctx.deposit.sourceTxHash,
                })),
                on: {
                    SIGN_ERROR: {
                        target: "errorAccepting",
                        actions: assign({
                            deposit: (ctx, evt) => ({
                                ...ctx.deposit,
                                error: evt.data,
                            }),
                        }),
                    },
                    SIGNED: {
                        target: "accepted",
                        actions: assign({
                            deposit: (ctx, evt) => ({
                                ...ctx.deposit,
                                ...evt.data,
                            }),
                        }),
                    },
                },
                meta: { test: async () => {} },
            },

            errorAccepting: {
                entry: [log((ctx, _) => ctx.deposit.error, "ERROR")],
                meta: {
                    test: async (_: void, state: any) => {
                        assert(
                            state.context.deposit.error ? true : false,
                            "error must exist",
                        );
                    },
                },
            },

            accepted: {
                entry: sendParent((ctx, _) => {
                    return {
                        type: "CLAIMABLE",
                        data: ctx.deposit,
                    };
                }),
                on: {
                    CLAIM: {
                        target: "claiming",
                        actions: assign({
                            deposit: (ctx, evt) => ({
                                ...ctx.deposit,
                                contractParams: evt.data,
                            }),
                        }),
                    },
                    REJECT: "rejected",
                },
                meta: { test: async () => {} },
            },

            errorSubmitting: {
                entry: [
                    log((ctx, _) => ctx.deposit.error, "ERROR"),
                    sendParent((ctx, _) => {
                        return {
                            type: "CLAIMABLE",
                            data: ctx.deposit,
                        };
                    }),
                ],
                on: {
                    CLAIM: {
                        target: "claiming",
                        actions: assign({
                            deposit: (ctx, evt) => ({
                                ...ctx.deposit,
                                contractParams: evt.data,
                            }),
                        }),
                    },
                    REJECT: "rejected",
                },
                meta: {
                    test: async (_: void, state: any) => {
                        assert(
                            state.context.deposit.error ? true : false,
                            "error must exist",
                        );
                    },
                },
            },

            claiming: {
                entry: sendParent((ctx) => ({
                    type: "MINT",
                    hash: ctx.deposit.sourceTxHash,
                    data: ctx.deposit.contractParams,
                })),
                on: {
                    SUBMIT_ERROR: [
                        {
                            target: "errorSubmitting",
                            actions: [
                                assign({
                                    deposit: (ctx, evt) => ({
                                        ...ctx.deposit,
                                        error: evt.data,
                                    }),
                                }),
                                sendParent((ctx, _) => ({
                                    type: "DEPOSIT_UPDATE",
                                    data: ctx.deposit,
                                })),
                            ],
                        },
                    ],
                    SUBMITTED: [
                        {
                            target: "destInitiated",
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
                meta: { test: async () => {} },
            },

            destInitiated: {
                on: {
                    ACKNOWLEDGE: "completed",
                },
                meta: { test: async () => {} },
            },

            rejected: {
                meta: { test: async () => {} },
            },

            completed: {
                entry: sendParent((ctx, _) => ({
                    type: "DEPOSIT_COMPLETED",
                    data: ctx.deposit,
                })),
                meta: { test: async () => {} },
            },
        },
    },

    {
        guards: {
            isSrcSettling: ({
                deposit: { sourceTxConfs, sourceTxConfTarget },
            }) => (sourceTxConfs || 0) < (sourceTxConfTarget || 1),
            isSrcConfirmed: () => false,
            isSrcSettled: ({
                deposit: { sourceTxConfs, sourceTxConfTarget },
            }) => (sourceTxConfs || 0) >= (sourceTxConfTarget || 1),
            isAccepted: ({ deposit: { renSignature } }) =>
                renSignature ? true : false,
            isDestInitiated: ({ deposit: { destTxHash } }) =>
                destTxHash ? true : false,
        },
    },
);
