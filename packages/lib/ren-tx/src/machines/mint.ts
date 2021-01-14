/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import { Actor, assign, Machine, send } from "xstate";
import RenJS from "@renproject/ren";
import { LockChain, MintChain } from "@renproject/interfaces";
import { assert } from "@renproject/utils";
import { log } from "xstate/lib/actions";

import { GatewaySession, GatewayTransaction } from "../types/transaction";
import { depositMachine } from "./deposit";

export interface GatewayMachineContext {
    /**
     * The session arguments used for instantiating a mint gateway
     */
    tx: GatewaySession;
    /**
     * Automatically add fees to the tx suggestedAmount when creating
     */
    autoFees?: boolean;
    /**
     * @private
     * A reference to a deposit hash that is requesting a mint signature /
     * tx submission
     */
    signatureRequest?: string | null;
    /**
     * @private
     * Keeps track of child machines that track underlying deposits
     */
    depositMachines?: { [key in string]: Actor<typeof depositMachine> };
    /**
     * @private
     * a listener callback that interacts with renjs deposit objects
     */
    depositListenerRef?: Actor<any>;
    /**
     * Providers needed for LockChains
     */
    providers: any;
    /**
     * Functions to create the "from" param;
     */
    fromChainMap: {
        [key in string]: (context: GatewayMachineContext) => LockChain<any>;
    };

    /**
     * Functions to create the "to" RenJS param;
     */
    toChainMap: {
        [key in string]: (context: GatewayMachineContext) => MintChain<any>;
    };
    sdk: RenJS;
}

export interface GatewayMachineSchema {
    states: {
        restoring: {};
        creating: {};
        srcInitializeError: {};
        listening: {};
        requestingSignature: {};
        completed: {};
    };
}

export type GatewayMachineEvent =
    | { type: "CLAIMABLE"; data: GatewayTransaction }
    | { type: "ERROR_LISTENING"; data: any }
    | { type: "DEPOSIT"; data: GatewayTransaction }
    | { type: "DEPOSIT_UPDATE"; data: GatewayTransaction }
    | { type: "DEPOSIT_COMPLETED"; data: GatewayTransaction }
    | { type: "REQUEST_SIGNATURE"; data: GatewayTransaction }
    | { type: "SIGN"; data: GatewayTransaction }
    | { type: "EXPIRED"; data: GatewayTransaction }
    | { type: "ACKNOWLEDGE"; data: any }
    | { type: "RESTORE"; data: GatewayTransaction };

/**
 * An Xstate machine that, when given a serializable [[GatewaySession]] tx,
 * will instantiate a RenJS LockAndMint session, provide a gateway address,
 * listen for deposits, and request a signature once a deposit has reached
 * the appropriate number of confirmations.
 *
 * Given the same [[GatewaySession]] parameters, as long as the tx has not
 * expired, the machine will restore the transaction to the appropriate
 * state and enable the completion of in-progress minting transactions.
 *
 * The machine allows for multiple deposits to be detected; it is up to the
 * developer to decide if a detected deposit should be signed or rejected.
 * See `/demos/simpleMint.ts` for example usage.
 */
export const mintMachine = Machine<
    GatewayMachineContext,
    GatewayMachineSchema,
    GatewayMachineEvent
>({
    id: "RenVMGatewaySession",
    initial: "restoring",
    states: {
        restoring: {
            entry: [
                send("RESTORE"),
                assign({ depositMachines: (_ctx, _evt) => ({}) }),
            ],
            meta: { test: async () => {} },
            on: {
                RESTORE: [
                    {
                        target: "completed",
                        cond: "isExpired",
                    },
                    {
                        target: "listening",
                        actions: "depositMachineSpawner",
                        cond: "isCreated",
                    },
                    {
                        target: "creating",
                    },
                ],
            },
        },

        creating: {
            meta: {
                test: (_: void, state: any) => {
                    assert(
                        !state.context.tx.gatewayAddress ? true : false,
                        "Gateway address should not be initialized",
                    );
                },
            },
            invoke: {
                src: "txCreator",
                onDone: {
                    target: "listening",
                    actions: assign({
                        tx: (_context, evt) => ({ ...evt.data }),
                    }),
                },
                onError: {
                    target: "srcInitializeError",
                    actions: [
                        assign({
                            tx: (context, evt) => {
                                const newTx = {
                                    ...context.tx,
                                    error: evt.data || true,
                                };
                                return newTx;
                            },
                        }),
                        log((_ctx, evt) => evt.data),
                    ],
                },
            },
        },

        srcInitializeError: {
            meta: {
                test: (_: void, state: any) => {
                    assert(
                        state.context.tx.error ? true : false,
                        "Error must exist",
                    );
                },
            },
        },

        listening: {
            meta: {
                test: (_: void, state: any) => {
                    assert(
                        state.context.tx.gatewayAddress ? true : false,
                        "GatewayAddress must exist",
                    );
                },
            },
            invoke: {
                src: "depositListener",
            },
            on: {
                EXPIRED: "completed",
                ERROR_LISTENING: {
                    target: "srcInitializeError",
                    actions: [
                        assign({
                            tx: (context, evt) => {
                                const newTx = {
                                    ...context.tx,
                                    error: evt.data || true,
                                };
                                return newTx;
                            },
                        }),
                        log((_ctx, evt) => evt.data),
                    ],
                },

                CLAIMABLE: {
                    actions: assign({
                        signatureRequest: (_context, evt) => {
                            return evt.data?.sourceTxHash;
                        },
                        tx: (context, evt) => {
                            if (evt.data?.sourceTxHash) {
                                context.tx.transactions[evt.data.sourceTxHash] =
                                    evt.data;
                            }
                            return context.tx;
                        },
                    }),
                    target: "requestingSignature",
                },

                DEPOSIT_COMPLETED: {
                    target: "completed",
                    cond: "isCompleted",
                },
                DEPOSIT_UPDATE: [
                    {
                        actions: assign({
                            tx: (context, evt) => {
                                if (evt.data?.sourceTxHash) {
                                    context.tx.transactions[
                                        evt.data.sourceTxHash
                                    ] = evt.data;
                                }
                                return context.tx;
                            },
                        }),
                    },
                ],

                DEPOSIT: {
                    actions: [
                        assign({
                            tx: (context, evt) => {
                                // Replace the transaction with the newly
                                // detected one; the listener will provide
                                // persisted data if it is already present
                                if (evt.data?.sourceTxHash) {
                                    context.tx.transactions[
                                        evt.data.sourceTxHash
                                    ] = evt.data;
                                }
                                return context.tx;
                            },
                        }),
                        "spawnDepositMachine",
                    ],
                },
            },
        },
        requestingSignature: {
            on: {
                SIGN: {
                    target: "listening",
                    actions: send("CLAIM", {
                        to: (ctx) => {
                            if (!ctx.depositMachines) return "";
                            return ctx.depositMachines[
                                ctx.signatureRequest || ""
                            ];
                        },
                    }),
                },
                DEPOSIT_UPDATE: [
                    {
                        cond: "isRequestCompleted",
                        actions: assign({
                            signatureRequest: (_ctx, _evt) => null,
                            tx: (ctx, evt) => {
                                if (evt.data?.sourceTxHash) {
                                    ctx.tx.transactions[evt.data.sourceTxHash] =
                                        evt.data;
                                }
                                return ctx.tx;
                            },
                        }),
                    },
                ],
            },
            meta: {
                test: (_: any, state: any) => {
                    if (
                        Object.keys(state.context.tx.transactions || {})
                            .length === 0
                    ) {
                        throw Error(
                            "A deposit must exist for a signature to be requested",
                        );
                    }
                },
            },
        },
        completed: {
            meta: {
                test: (_: any, state: any) => {
                    if (state.context.depositListenerRef) {
                        throw Error("Deposit listener has not been cleaned up");
                    }
                },
            },
        },
    },
});
