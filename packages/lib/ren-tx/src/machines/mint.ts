/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    Actor,
    assign,
    createMachine,
    send,
    SpawnedActorRef,
    State,
} from "xstate";
import RenJS from "@renproject/ren";
import { DepositCommon, LockChain, MintChain } from "@renproject/interfaces";
import { assert } from "@renproject/utils";
import { log } from "xstate/lib/actions";
import { UTXO } from "@renproject/chains-bitcoin/build/main/APIs/API";

import {
    AllGatewayTransactions,
    AcceptedGatewayTransaction,
    ConfirmingGatewayTransaction,
    GatewaySession,
    GatewayTransaction,
    MintedGatewayTransaction,
    isMinted,
    OpenedGatewaySession,
    isOpen,
} from "../types/mint";
import {
    DepositMachineContext,
    DepositMachineEvent,
    DepositMachineSchema,
    DepositMachineTypestate,
} from "./deposit";

export interface GatewayMachineContext<DepositType, MintType = any> {
    /**
     * The session arguments used for instantiating a mint gateway
     */
    tx: GatewaySession<DepositType> | OpenedGatewaySession<DepositType>;
    /**
     * A reference to a deposit hashes of transactions that can be
     * minted on their destination chains
     */
    mintRequests?: string[];
    /**
     * @private
     * Keeps track of child machines that track underlying deposits
     */
    depositMachines?: {
        [key in string]: SpawnedActorRef<
            DepositMachineEvent<DepositType>,
            State<
                DepositMachineContext<AllGatewayTransactions<DepositType>>,
                DepositMachineEvent<DepositType>,
                DepositMachineSchema<DepositType>,
                DepositMachineTypestate<DepositType>
            >
        >;
    };
    /**
     * @private
     * a listener callback that interacts with renjs deposit objects
     */
    depositListenerRef?: Actor<any>;
    /**
     * Function to create the "from" param;
     */
    from: (
        context: GatewayMachineContext<DepositType>,
    ) => LockChain<DepositType, DepositCommon<DepositType>>;

    /**
     * Function to create the "to" RenJS param;
     */
    to: (context: GatewayMachineContext<DepositType>) => MintChain<MintType>;
    sdk: RenJS;
}

export enum GatewayStates {
    RESTORING = "restoring",
    CREATING = "creating",
    ERROR_CREATING = "srcInitializeError",
    LISTENING = "listening",
    COMPLETED = "completed",
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

export type DepositEvent<DepositType> = {
    type: "DEPOSIT";
    data: GatewayTransaction<DepositType>;
};

export type GatewayMachineEvent<DepositType> =
    | DepositMachineEvent<DepositType>
    | { type: "CLAIMABLE"; data: AcceptedGatewayTransaction<DepositType> }
    | { type: "ERROR_LISTENING"; data: any }
    | DepositEvent<DepositType>
    | { type: "DEPOSIT_UPDATE"; data: AllGatewayTransactions<DepositType> }
    | { type: "DEPOSIT_COMPLETED"; data: MintedGatewayTransaction<DepositType> }
    | { type: "SIGN"; data: ConfirmingGatewayTransaction<DepositType> }
    | { type: "SETTLE"; data: GatewayTransaction<DepositType> }
    | { type: "MINT"; data: AcceptedGatewayTransaction<DepositType> }
    | { type: "EXPIRED"; data: GatewayTransaction<DepositType> }
    | { type: "ACKNOWLEDGE"; data: any }
    | { type: "RESTORE"; data: GatewayTransaction<DepositType> };

type extractGeneric<Type> = Type extends LockChain<infer X> ? X : never;

export interface LockChainMap<Context> {
    [key: string]: (context: Context) => LockChain<any, DepositCommon<any>>;
}

export interface MintChainMap<Context> {
    [key: string]: (context: Context) => MintChain<any>;
}

export const buildMintContextWithMap = <X>(params: {
    tx: GatewaySession<X> | OpenedGatewaySession<X>;
    sdk: RenJS;
    /**
     * Functions to create the "from" param;
     */
    fromChainMap: LockChainMap<GatewayMachineContext<X>>;

    /**
     * Functions to create the "to" RenJS param;
     */
    toChainMap: MintChainMap<GatewayMachineContext<X>>;
}) => {
    const from = params.fromChainMap[params.tx.sourceChain];
    const to = params.toChainMap[params.tx.destChain];
    const constructed: GatewayMachineContext<
        extractGeneric<ReturnType<typeof from>>
    > = {
        tx: params.tx,
        to,
        sdk: params.sdk,
        from,
    };
    return constructed;
};

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
export const buildMintMachine = <X extends UTXO>() =>
    createMachine<GatewayMachineContext<X>, GatewayMachineEvent<X>>(
        {
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
                                log((_ctx, evt) => evt.data, "ERROR"),
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
                        // once we have ren-js listening for deposits,
                        // start the statemachines to determine deposit states
                        LISTENING: { actions: "depositMachineSpawner" },
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
                                log((_ctx, evt) => evt.data, "ERROR"),
                            ],
                        },

                        // forward messages from child machines to renjs listeners
                        RESTORE: [
                            {
                                cond: "isPersistedDeposit",
                                actions: "forwardEvent",
                            },
                            {
                                actions: [
                                    assign({
                                        tx: ({ tx }, e) => {
                                            if (!e.data.sourceTxHash) return tx;
                                            return {
                                                ...tx,
                                                transactions: {
                                                    ...tx.transactions,
                                                    [e.data.sourceTxHash]:
                                                        e.data,
                                                },
                                            } as any;
                                        },
                                    }),
                                    "spawnDepositMachine",
                                    "forwardEvent",
                                ],
                            },
                        ],
                        SETTLE: {
                            actions: "forwardEvent",
                        },
                        SIGN: {
                            actions: "forwardEvent",
                        },
                        MINT: {
                            actions: "forwardEvent",
                        },

                        // Send messages to child machines
                        RESTORED: {
                            actions: "routeEvent",
                        },
                        CLAIM: { actions: "routeEvent" },
                        CONFIRMATION: { actions: "routeEvent" },
                        CONFIRMED: { actions: "routeEvent" },
                        ERROR: { actions: "routeEvent" },
                        SIGN_ERROR: { actions: "routeEvent" },
                        REVERTED: { actions: "routeEvent" },
                        SUBMIT_ERROR: { actions: "routeEvent" },
                        SIGNED: { actions: "routeEvent" },
                        SUBMITTED: { actions: "routeEvent" },
                        ACKNOWLEDGE: { actions: "routeEvent" },

                        CLAIMABLE: {
                            actions: assign({
                                mintRequests: (context, evt) => {
                                    const oldRequests =
                                        context.mintRequests || [];
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
                                        context.tx.transactions[
                                            evt.data.sourceTxHash
                                        ] = evt.data;
                                    }
                                    return context.tx;
                                },
                            }),
                        },

                        // We only complete when expiring
                        // DEPOSIT_COMPLETED: {
                        //     target: "completed",
                        //     cond: "isCompleted",
                        // },

                        DEPOSIT_UPDATE: [
                            {
                                actions: [
                                    assign({
                                        mintRequests: (ctx, evt) => {
                                            // check if completed
                                            if (isMinted(evt.data)) {
                                                return (
                                                    ctx.mintRequests?.filter(
                                                        (x) =>
                                                            x !==
                                                            evt.data
                                                                .sourceTxHash,
                                                    ) || []
                                                );
                                            } else {
                                                return ctx.mintRequests;
                                            }
                                        },
                                        tx: (context, evt) => {
                                            if (evt.data.sourceTxHash) {
                                                context.tx.transactions[
                                                    evt.data.sourceTxHash
                                                ] = evt.data;
                                            }
                                            return context.tx;
                                        },
                                    }),
                                    send(
                                        (_, evt) => {
                                            return {
                                                type: "UPDATE",
                                                hash: evt.data.sourceTxHash,
                                                data: evt.data,
                                            };
                                        },
                                        {
                                            to: (
                                                _ctx: GatewayMachineContext<X>,
                                            ) => "depositListener",
                                        },
                                    ),
                                ],
                            },
                        ],

                        DEPOSIT: {
                            cond: "isNewDeposit",
                            actions: [
                                assign({
                                    tx: (context, evt) => {
                                        // Replace the transaction with the newly
                                        // detected one; the listener will provide
                                        // persisted data if it is already present
                                        return {
                                            ...context.tx,
                                            transactions: {
                                                ...context.tx.transactions,
                                                [evt.data.sourceTxHash]:
                                                    evt.data,
                                            },
                                        };
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
                                throw Error(
                                    "Deposit listener has not been cleaned up",
                                );
                            }
                        },
                    },
                },
            },
        },
        {
            guards: {
                isPersistedDeposit: (ctx, evt) => {
                    const depositEvt = evt as DepositEvent<X>;
                    if (!depositEvt.data) return false;
                    return (ctx.tx.transactions || {})[
                        depositEvt.data.sourceTxHash
                    ]
                        ? true
                        : false;
                },
                isNewDeposit: (ctx, evt) => {
                    const depositEvt = evt as DepositEvent<X>;
                    if (!depositEvt.data) return false;
                    return !(ctx.depositMachines || {})[
                        depositEvt.data.sourceTxHash
                    ];
                },
                isExpired: ({ tx }) => tx.expiryTime < new Date().getTime(),
                isCreated: ({ tx }) => isOpen(tx),
            },
        },
    );
