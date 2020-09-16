import { Machine, assign, send } from "xstate";
import RenJS from "@renproject/ren";
import { GatewaySession, GatewayTransaction } from "../types/transaction";
import { LockChain, MintChain } from "@renproject/interfaces";

export interface BurnMachineContext {
    tx: GatewaySession;
    sdk: RenJS;
    providers: any; // The blockchain api providers required for the mintchain
    toChainMap: {
        [key in string]: (context: BurnMachineContext) => LockChain<any>;
    }; // Functions to create the "to" param;
    fromChainMap: {
        [key in string]: (context: BurnMachineContext) => MintChain<any>;
    }; // Functions to create the "from" param;
}

// We have different states for a burn machine, as there can only be one transaction
export interface BurnMachineSchema {
    states: {
        restoring: {};
        created: {};
        createError: {};
        srcSettling: {};
        srcConfirmed: {};
        accepted: {};
        destSettling: {};
        destConfirmed: {};
    };
}

const getFirstTx = (tx: GatewaySession) => Object.values(tx.transactions)[0];

export type BurnMachineEvent =
    | { type: "NOOP" }
    | { type: "RETRY" }
    | { type: "RESTORE" }
    | { type: "RELEASE_ERROR"; data: any }
    | { type: "BURN_ERROR"; data: any }
    | { type: "CONFIRMATION"; data: GatewayTransaction }
    | { type: "CONFIRMED"; data: GatewayTransaction };

export const burnMachine = Machine<
    BurnMachineContext,
    BurnMachineSchema,
    BurnMachineEvent
>(
    {
        id: "RenVMBurnMachine",
        initial: "restoring",
        states: {
            restoring: {
                entry: send("RESTORE"),
                on: {
                    RESTORE: [
                        { target: "srcConfirmed", cond: "isSrcConfirmed" },
                        { target: "srcSettling", cond: "isSrcSettling" },
                        { target: "created" },
                    ],
                },
            },
            created: {
                invoke: {
                    src: "burnCreator",
                    onDone: {
                        target: "srcSettling",
                        actions: assign({
                            tx: (ctx, evt) => ({ ...ctx.tx, ...evt.data }),
                        }),
                    },
                    onError: {
                        target: "createError",
                        actions: assign({
                            tx: (ctx, evt) => ({ ...ctx.tx, error: evt.data }),
                        }),
                    },
                },
            },
            createError: {
                on: {
                    RETRY: "created",
                },
            },
            srcSettling: {
                invoke: {
                    src: "burnListener",
                },
                on: {
                    CONFIRMATION: {
                        // update src confs
                        actions: assign({
                            tx: (ctx, evt) => ({
                                ...ctx.tx,
                                transactions: {
                                    [evt.data.sourceTxHash]: evt.data,
                                },
                            }),
                        }),
                    },
                    CONFIRMED: {
                        target: "srcConfirmed",
                    },
                },
            },
            srcConfirmed: {},
            accepted: {},
            destSettling: {},
            destConfirmed: {},
        },
    },
    {
        guards: {
            isSrcSettling: (ctx, _evt) =>
                getFirstTx(ctx.tx)?.sourceTxHash ? true : false,
            isSrcConfirmed: (ctx, _evt) =>
                getFirstTx(ctx.tx)?.sourceTxConfs >=
                (getFirstTx(ctx.tx)?.sourceTxConfTarget ??
                    Number.POSITIVE_INFINITY),
        },
    }
);
