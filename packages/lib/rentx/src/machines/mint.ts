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
    tx: GatewaySession; // The session arguments used for instantiating a mint gateway
    signatureRequest?: string;
    depositMachines?: { [key in string]: Actor<typeof depositMachine> }; // Keeps track of child machines that track underlying deposits
    depositListenerRef?: Actor<any>; // a listener callback that interacts with renjs deposit objects
    providers: any; // Providers needed for LockChains
    fromChainMap: {
        [key in string]: (context: GatewayMachineContext) => LockChain<any>;
    }; // Functions to create the "from" param;
    toChainMap: {
        [key in string]: (context: GatewayMachineContext) => MintChain<any>;
    }; // Functions to create the "to" param;
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
    | { type: "DEPOSIT"; data: GatewayTransaction }
    | { type: "DEPOSIT_UPDATE"; data: GatewayTransaction }
    | { type: "DEPOSIT_COMPLETED"; data: GatewayTransaction }
    | { type: "REQUEST_SIGNATURE"; data: GatewayTransaction }
    | { type: "SIGN"; data: GatewayTransaction }
    | { type: "EXPIRED"; data: GatewayTransaction }
    | { type: "ACKNOWLEDGE"; data: any }
    | { type: "RESTORE"; data: GatewayTransaction };

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
