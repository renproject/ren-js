/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import {
    assign,
    createMachine,
    createSchema,
    send,
    sendParent,
    StateSchema,
} from "xstate";
import { log } from "xstate/lib/actions";
import { assert } from "@renproject/utils";

import {
    AcceptedGatewayTransaction,
    AllGatewayTransactions,
    ConfirmingGatewayTransaction,
    GatewayTransaction,
    isAccepted,
    isCompleted,
    isConfirming,
    isMinted,
    isSubmitted,
    MintedGatewayTransaction,
    SubmittingGatewayTransaction,
} from "../types/mint";

type extractGeneric<Type> = Type extends AllGatewayTransactions<infer X>
    ? X
    : never;
/** The context that the deposit machine acts on */
export interface DepositMachineContext<
    Deposit extends AllGatewayTransactions<extractGeneric<Deposit>>
> {
    /** The deposit being tracked */
    deposit: Deposit;
}

const largest = (x?: number, y?: number): number => {
    if (!x) {
        if (y) return y;
        return 0;
    }
    if (!y) {
        if (x) return x;
        return 0;
    }
    if (x > y) return x;
    return y;
};

export enum DepositStates {
    CHECKING_COMPLETION = "checkingCompletion",
    /** We are waiting for ren-js to find the deposit */
    RESTORING_DEPOSIT = "restoringDeposit",
    /** We couldn't restore this deposit */
    ERROR_RESTORING = "errorRestoring",
    /** renjs has found the deposit for the transaction */
    RESTORED_DEPOSIT = "restoredDeposit",
    /** we are waiting for the source chain to confirm the transaction */
    CONFIRMING_DEPOSIT = "srcSettling",
    /** source chain has confirmed the transaction, submitting to renvm for signature */
    RENVM_SIGNING = "srcConfirmed",
    /** renvm has accepted and signed the transaction */
    RENVM_ACCEPTED = "accepted",
    /** renvm did not accept the tx */
    ERROR_SIGNING = "errorAccepting",
    /** the user is submitting the transaction to mint on the destination chain */
    SUBMITTING_MINT = "claiming",
    /** there was an error submitting the tx to the destination chain */
    ERROR_MINTING = "errorSubmitting",
    /** We have recieved a txHash for the destination chain */
    MINTING = "destInitiated",
    /** user has acknowledged that the transaction is completed, so we can stop listening for further deposits */
    COMPLETED = "completed",
    /** user does not want to mint this deposit or the transaction reverted */
    REJECTED = "rejected",
}

export type DepositMachineTypestate<X> =
    | {
          value: DepositStates.CHECKING_COMPLETION;
          context: DepositMachineContext<AllGatewayTransactions<X>>;
      }
    | {
          value: DepositStates.RESTORING_DEPOSIT;
          context: DepositMachineContext<AllGatewayTransactions<X>>;
      }
    | {
          value: DepositStates.ERROR_RESTORING;
          context: DepositMachineContext<GatewayTransaction<X>>;
      }
    | {
          value: DepositStates.RESTORED_DEPOSIT;
          context: DepositMachineContext<GatewayTransaction<X>>;
      }
    | {
          value: DepositStates.CONFIRMING_DEPOSIT;
          context: DepositMachineContext<ConfirmingGatewayTransaction<X>>;
      }
    | {
          value: DepositStates.RENVM_SIGNING;
          context: DepositMachineContext<AcceptedGatewayTransaction<X>>;
      }
    | {
          value: DepositStates.RENVM_ACCEPTED;
          context: DepositMachineContext<AcceptedGatewayTransaction<X>>;
      }
    | {
          value: DepositStates.ERROR_SIGNING;
          context: DepositMachineContext<ConfirmingGatewayTransaction<X>>;
      }
    | {
          value: DepositStates.SUBMITTING_MINT;
          context: DepositMachineContext<SubmittingGatewayTransaction<X>>;
      }
    | {
          value: DepositStates.ERROR_MINTING;
          context: DepositMachineContext<SubmittingGatewayTransaction<X>>;
      }
    | {
          value: DepositStates.MINTING;
          context: DepositMachineContext<MintedGatewayTransaction<X>>;
      }
    | {
          value: DepositStates.COMPLETED;
          context: DepositMachineContext<MintedGatewayTransaction<X>>;
      }
    | {
          value: DepositStates.REJECTED;
          context: DepositMachineContext<GatewayTransaction<X>>;
      };

/** The states a deposit can be in */
export interface DepositMachineSchema<X>
    extends StateSchema<DepositMachineContext<AllGatewayTransactions<X>>> {
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

export interface ContractParams {
    [key: string]: any;
}

export type DepositMachineEvent<X> =
    | { type: "NOOP" }
    | { type: "CHECK" }
    | { type: "LISTENING" }
    | { type: "DETECTED" }
    | { type: "ERROR"; data: Partial<GatewayTransaction<X>>; error: Error }
    | { type: "RESTORE"; data: Partial<AllGatewayTransactions<X>> }
    | { type: "RESTORED"; data: AllGatewayTransactions<X> }
    | { type: "CONFIRMED"; data: Partial<ConfirmingGatewayTransaction<X>> }
    | { type: "CONFIRMATION"; data: Partial<ConfirmingGatewayTransaction<X>> }
    | { type: "SIGNED"; data: AcceptedGatewayTransaction<X> }
    | { type: "SIGN_ERROR"; data: GatewayTransaction<X>; error: Error }
    | { type: "REVERTED"; data: GatewayTransaction<X>; error: Error }
    | {
          type: "CLAIM";
          data: AcceptedGatewayTransaction<X>;
          params: ContractParams;
      }
    | { type: "REJECT" }
    | { type: "SUBMITTED"; data: Partial<SubmittingGatewayTransaction<X>> }
    | {
          type: "SUBMIT_ERROR";
          data: Partial<SubmittingGatewayTransaction<X>>;
          error: Error;
      }
    | { type: "ACKNOWLEDGE"; data: Partial<SubmittingGatewayTransaction<X>> };

/** Statemachine that tracks individual deposits */
export const buildDepositMachine = <X>() =>
    createMachine<
        DepositMachineContext<AllGatewayTransactions<X>>,
        DepositMachineEvent<X>,
        DepositMachineTypestate<X>
    >(
        {
            id: "RenVMDepositTransaction",
            initial: DepositStates.CHECKING_COMPLETION,
            schema: {
                events: createSchema<DepositMachineEvent<X>>(),
                context: createSchema<
                    DepositMachineContext<AllGatewayTransactions<X>>
                >(),
            },
            states: {
                // Checking if deposit is completed so that we can skip initialization
                checkingCompletion: {
                    entry: [send("CHECK")],

                    // If we already have completed, no need to listen
                    on: {
                        CHECK: [
                            {
                                target: "completed",
                                cond: "isCompleted",
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
                            actions: [assign((_, e) => ({ deposit: e.data }))],
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
                            // We need to call "submit" again in case
                            // a transaction has been sped up / ran out of gas
                            // so we revert back to accepted when restored instead
                            // of waiting on destination initiation
                            // {
                            //     target: "destInitiated",
                            //     cond: "isDestInitiated",
                            // },
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
                                    assign({
                                        deposit: ({ deposit }, evt) => {
                                            if (
                                                isConfirming(deposit) &&
                                                deposit.sourceTxConfTarget
                                            ) {
                                                return {
                                                    ...deposit,
                                                    sourceTxConfs: largest(
                                                        deposit.sourceTxConfs,
                                                        evt.data.sourceTxConfs,
                                                    ),
                                                    sourceTxConfTarget: largest(
                                                        deposit.sourceTxConfTarget,
                                                        evt.data
                                                            .sourceTxConfTarget,
                                                    ),
                                                };
                                            }
                                            return deposit;
                                        },
                                    }),
                                    sendParent((ctx, _) => {
                                        return {
                                            type: "DEPOSIT_UPDATE",
                                            data: ctx.deposit,
                                        };
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
                                                evt.data?.sourceTxConfTarget,
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
                                    error: evt.error,
                                }),
                            }),
                        },
                        REVERTED: {
                            target: "rejected",
                            actions: assign({
                                deposit: (ctx, evt) => ({
                                    ...ctx.deposit,
                                    error: evt.error,
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
                        test: (_: void, state: any) => {
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
                                    contractParams: evt.params,
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
                        test: (_: void, state: any) => {
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
                        data:
                            isSubmitted(ctx.deposit) &&
                            ctx.deposit.contractParams,
                    })),
                    on: {
                        SUBMIT_ERROR: [
                            {
                                target: "errorSubmitting",
                                actions: [
                                    assign({
                                        deposit: (ctx, evt) => ({
                                            ...ctx.deposit,
                                            error: evt.error,
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
                        ACKNOWLEDGE: {
                            target: "completed",
                            actions: [
                                assign({
                                    deposit: (ctx, _) => ({
                                        ...ctx.deposit,
                                        completedAt: new Date().getTime(),
                                    }),
                                }),
                            ],
                        },
                    },
                    meta: { test: async () => {} },
                },

                rejected: {
                    entry: [
                        sendParent((ctx, _) => {
                            return {
                                type: "DEPOSIT_UPDATE",
                                data: ctx.deposit,
                            };
                        }),
                    ],
                    meta: { test: async () => {} },
                },

                completed: {
                    entry: [
                        sendParent((ctx, _) => ({
                            type: "DEPOSIT_COMPLETED",
                            data: ctx.deposit,
                        })),
                        sendParent((ctx, _) => ({
                            type: "DEPOSIT_UPDATE",
                            data: ctx.deposit,
                        })),
                    ],
                    meta: {
                        test: (_: void, state: any) => {
                            assert(
                                state.context.deposit.completedAt
                                    ? true
                                    : false,
                                "Must have completedAt timestamp",
                            );
                        },
                    },
                },
            },
        },

        {
            guards: {
                isSrcSettling: ({ deposit }) =>
                    isConfirming(deposit) &&
                    (deposit.sourceTxConfs || 0) <
                        (deposit.sourceTxConfTarget ||
                            Number.POSITIVE_INFINITY), // If we don't know the target, keep settling
                isSrcSettled: ({ deposit }) =>
                    isConfirming(deposit) &&
                    (deposit.sourceTxConfs || 0) >= deposit.sourceTxConfTarget, // If we don't know the target, keep settling
                isAccepted: ({ deposit }) =>
                    isAccepted(deposit) && deposit.renSignature ? true : false,
                isDestInitiated: ({ deposit }) =>
                    isMinted(deposit) && deposit.destTxHash ? true : false,
                isCompleted: ({ deposit }) =>
                    isCompleted(deposit) && deposit.completedAt ? true : false,
            },
        },
    );
