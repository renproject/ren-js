/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import { Actor, assign, Machine, send } from "xstate";
import RenJS from "@renproject/ren";
import { LockChain, MintChain } from "@renproject/interfaces";
import { assert } from "@renproject/utils";
import { log } from "xstate/lib/actions";

import { GatewaySession, GatewayTransaction } from "../types/transaction";
import { depositMachine, DepositMachineEvent } from "./deposit";

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
     * A reference to a deposit hashes of transactions that can be
     * minted on their destination chains
     */
    mintRequests?: string[];
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
        completed: {};
    };
}

export type GatewayMachineEvent =
    | DepositMachineEvent
    | { type: "CLAIMABLE"; data: GatewayTransaction }
    | { type: "ERROR_LISTENING"; data: any }
    | { type: "DEPOSIT"; data: GatewayTransaction }
    | { type: "DEPOSIT_UPDATE"; data: GatewayTransaction }
    | { type: "DEPOSIT_COMPLETED"; data: GatewayTransaction }
    | { type: "REQUEST_SIGNATURE"; data: GatewayTransaction }
    | { type: "SIGN"; data: GatewayTransaction }
    | { type: "SETTLE"; data: GatewayTransaction }
    | { type: "MINT"; data: GatewayTransaction }
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
                assign({
                    mintRequests: (_c, _e) => [],
                    depositMachines: (_ctx, _evt) => ({}),
                }),
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

                RESTORED: {
                    actions: "broadcast",
                },

                SETTLE: {
                    actions: "forwardEvent",
                },
                SIGN: {
                    actions: "forwardEvent",
                },
                MINT: {
                    actions: "forwardEvent",
                },

                CLAIM: { actions: "routeEvent" },
                CONFIRMATION: { actions: "routeEvent" },
                CONFIRMED: { actions: "routeEvent" },
                ERROR: { actions: "routeEvent" },
                SIGN_ERROR: { actions: "routeEvent" },
                SIGNED: { actions: "routeEvent" },
                SUBMITTED: { actions: "routeEvent" },

                CLAIMABLE: {
                    actions: assign({
                        mintRequests: (context, evt) => {
                            const oldRequests = context.mintRequests || [];
                            const newRequest = evt.data?.sourceTxHash;
                            if (!newRequest) {
                                return oldRequests;
                            }

                            if (oldRequests.includes(newRequest)) {
                                return oldRequests;
                            }
                            return [...oldRequests, newRequest];
                        },
                        tx: (context, evt) => {
                            if (evt.data.sourceTxHash) {
                                context.tx.transactions[evt.data.sourceTxHash] =
                                    evt.data;
                            }
                            return context.tx;
                        },
                    }),
                },

                DEPOSIT_COMPLETED: {
                    target: "completed",
                    cond: "isCompleted",
                },

                DEPOSIT_UPDATE: [
                    {
                        actions: assign({
                            mintRequests: (ctx, evt) => {
                                // check if completed
                                if (evt.data.destTxHash) {
                                    return (
                                        ctx.mintRequests?.filter(
                                            (x) => x !== evt.data.sourceTxHash,
                                        ) || []
                                    );
                                } else {
                                    return ctx.mintRequests;
                                }
                            },
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
