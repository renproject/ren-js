/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import { Actor, assign, Machine, send, sendParent } from "xstate";
import RenJS from "@renproject/ren";
import { LockChain, MintChain } from "@renproject/interfaces";
import { log } from "xstate/lib/actions";
import { assert } from "@renproject/utils";

import { GatewaySession, GatewayTransaction } from "../types/transaction";

/** The context that the deposit machine acts on */
export interface DepositMachineContext {
    /** The deposit being tracked */
    deposit: GatewayTransaction;

    /** The transaction session the deposit is part of */
    tx: GatewaySession;

    /**
     * @private
     * The internal xstate callback actor that recieves and sends events to the ren-js
     * deposit
     * */
    depositListenerRef?: Actor<any>;

    /**
     * The blockchain providers required for constructing ren-js to/from parameters
     * */
    providers: any;

    /**
     * Functions to create the ren-js "from" param;
     * */
    fromChainMap: {
        [key in string]: (
            context: Omit<DepositMachineContext, "deposit">,
        ) => LockChain<any>;
    };

    /**
     * Functions to create the ren-js "to" param;
     * */
    toChainMap: {
        [key in string]: (
            context: Omit<DepositMachineContext, "deposit">,
        ) => MintChain<any>;
    };
    sdk: RenJS;
}

/**  The states a deposit can be in */
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
    | { type: "ERROR"; error: Error }
    | { type: "RESTORE"; data: string }
    | { type: "RESTORED"; data: string }
    | { type: "CONFIRMED" }
    | { type: "CONFIRMATION"; data: GatewayTransaction }
    | { type: "SIGNED"; data: GatewayTransaction }
    | { type: "SIGN_ERROR"; data: Error }
    | { type: "CLAIM"; data: ContractParams }
    | { type: "REJECT" }
    | { type: "SUBMITTED"; data: GatewayTransaction }
    | { type: "SUBMIT_ERROR"; data: Error }
    | { type: "ACKNOWLEDGE" };

/** Statemachine that tracks individual deposits */
export const depositMachine = Machine<
    DepositMachineContext,
    DepositMachineSchema,
    DepositMachineEvent
>(
    {
        id: "RenVMDepositTransaction",
        initial: "checkingCompletion",
        states: {
            errorRestoring: {
                entry: [log("restore error")],
                meta: {
                    test: async (_: void, state: any) => {
                        assert(
                            state.context.deposit.error ? true : false,
                            "error must exist",
                        );
                    },
                },
            },

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
                    test: async (_: void, state: any) => {
                        assert(
                            !state.context.tx.error ? true : false,
                            "Error must not exist",
                        );
                    },
                },
            },

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
                            },
                        ),
                    },

                    ERROR: [
                        {
                            target: "errorRestoring",
                            actions: assign({
                                deposit: (ctx, event) => ({
                                    ...ctx.deposit,
                                    error: event.error,
                                }),
                            }),
                        },
                    ],

                    DETECTED: [
                        {
                            target: "restoredDeposit",
                        },
                    ],
                },

                meta: {
                    test: async (_: void, state: any) => {
                        assert(
                            !state.context.tx.error ? true : false,
                            "Error must not exist",
                        );
                    },
                },
            },

            restoredDeposit: {
                entry: [send("RESTORED")],
                on: {
                    RESTORED: [
                        {
                            target: "errorRestoring",
                        },
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
                meta: { test: async () => {} },
            },
            srcConfirmed: {
                entry: send("SIGN", {
                    to: (context) =>
                        `${context.deposit.sourceTxHash}DepositListener`,
                }),
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
                entry: send(
                    (ctx) => ({
                        type: "MINT",
                        data: ctx.deposit.contractParams,
                    }),
                    {
                        to: (context) =>
                            `${context.deposit.sourceTxHash}DepositListener`,
                    },
                ),
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
