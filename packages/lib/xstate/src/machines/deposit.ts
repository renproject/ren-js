import { Machine, assign, send, Actor, sendParent } from "xstate";
import RenJS from "@renproject/ren";
import { GatewaySession, GatewayTransaction } from "../types/transaction";
import { LockChain, MintChain } from "@renproject/interfaces";
import { log } from "xstate/lib/actions";

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
        errorRestoring: {}; // We couldn't restore this deposit
        restoredDeposit: {}; // renjs has found the deposit for the transaction
        srcSettling: {}; // we are waiting for the source chain to confirm the transaction
        srcConfirmed: {}; // source chain has confirmed the transaction
        accepted: {}; // renvm has accepted and signed the transaction
        claiming: {}; // the user is submitting the transaction to mint on the destination chain
        destInitiated: {}; // We have recieved a txHash for the destination chain
        completed: {}; // user has acknowledged that the transaction is completed, so we can stop listening for further deposits
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
            errorRestoring: { entry: [log("restore error")] },
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
                entry: sendParent((ctx, _) => {
                    return {
                        type: "CLAIMABLE",
                        data: ctx.deposit,
                    };
                }),
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
            },
            destInitiated: {
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
                (sourceTxConfs || 0) <= 1,
            isSrcConfirmed: () => false,
            isSrcSettled: ({ deposit: { sourceTxConfs } }) =>
                (sourceTxConfs || 0) > 1,
            isAccepted: ({ deposit: { renSignature } }) =>
                renSignature ? true : false,
            isDestInitiated: ({ deposit: { destTxHash } }) =>
                destTxHash ? true : false,
        },
    }
);
