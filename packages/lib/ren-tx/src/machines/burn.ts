/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import { Actor, assign, Machine, send } from "xstate";
import RenJS from "@renproject/ren";
import { LockChain, MintChain } from "@renproject/interfaces";
import { assert } from "@renproject/utils";

import { GatewaySession, GatewayTransaction } from "../types/transaction";

export interface BurnMachineContext {
    /**
     * The TX to be processed
     */
    tx: GatewaySession;
    sdk: RenJS;
    /**
     * Automatically add fees to the tx suggestedAmount when creating
     */
    autoFees?: boolean;
    /**
     * Automatically request burn submission to the host chain provider
     * (eg. will prompt web3 tx dialog after starting machine)
     */
    autoSubmit?: boolean;

    /**
     * The blockchain api providers required for the host chain
     */
    providers: any;

    /**
     * Functions to create the "to" RenJS param, for each native chain that you
     * want to support
     *
     * Example:
     * ```js
     * cosnt toChainMap = {
     *     bitcoin: (context: GatewayMachineContext) =>
     *         Bitcoin().Address(context.tx.destAddress),
     * }
     * ```
     */
    toChainMap: {
        [key: string]: (context: BurnMachineContext) => LockChain<any>;
    };

    /**
     * Functions to create the "from" RenJS param, for each host chain that you
     * want to support.
     * Example:
     * ```js
     * const fromChainMap = {
     *     ethereum: (context: GatewayMachineContext) => {
     *         const {
     *             destAddress,
     *             sourceChain,
     *             suggestedAmount,
     *             network,
     *         } = context.tx;
     *         const { providers } = context;
     *
     *         return Ethereum(providers[sourceChain], network).Account({
     *             address: destAddress,
     *             value: suggestedAmount,
     *         });
     *     },
     * }
     * ```
     */
    fromChainMap: {
        [key: string]: (context: BurnMachineContext) => MintChain<any>;
    };
    /**
     * @private
     * Tracks the RenJS BurnAndRelease callback
     */
    burnListenerRef?: Actor<any>;
}

// We have different states for a burn machine, as there can only be one transaction
export interface BurnMachineSchema {
    states: {
        /** Tx is resolving which state it should be in based on feedback from renjs */
        restoring: {};

        /** Tx is being initialized by renjs */
        creating: {};

        /** Tx has been initialized by renjs successfully and is ready to be submitted*/
        created: {};

        /** We encountered an error initializing the tx. Might be an issue submitting the
         * burn tx to the host chain */
        createError: {};

        /** Source/host chain is awaiting sufficient confirmations */
        srcSettling: {};

        /** There was an error encountered while processing the burn tx
         * Could be either from renvm or the host chain */
        errorBurning: {};

        /** Source/host chain has reached sufficient confirmations and tx
         * can be submitted to renVM for release */
        srcConfirmed: {};

        /** RenVM has recieved the tx and provided a hash */
        // accepted: {};

        /** An error occored while processing the release
         * Should only come from renVM */
        errorReleasing: {};

        /** The release tx has successfully been broadcast
         * For network v0.3 we get the release destTxHash
         * otherwise it will never be provided
         */
        destInitiated: {};
    };
}

const getFirstTx = (tx: GatewaySession) => Object.values(tx.transactions)[0];

export type BurnMachineEvent =
    | { type: "NOOP" }
    | { type: "RETRY" }
    | { type: "RESTORE" }
    | { type: "CREATED" }
    | { type: "SUBMIT" }
    | { type: "SUBMITTED"; data: GatewayTransaction }
    | { type: "RELEASE_ERROR"; data: any }
    | { type: "BURN_ERROR"; data: any }
    | { type: "CONFIRMATION"; data: GatewayTransaction }
    | { type: "CONFIRMED"; data: GatewayTransaction }
    | { type: "RELEASED"; data: any };

/**
 * An Xstate machine that, when given a serializable [[GatewaySession]] tx,
 * will instantiate a RenJS BurnAndRelease session, prompt the user to submit a
 * burn transaction (or automatically submit if the `autoSubmit` flag is set),
 * on the host chain, listen for confirmations, and detect the release transaction
 * once the native asset has been released.
 *
 * Given the same [[GatewaySession]] parameters, as long as the tx has not
 * expired, the machine will restore the transaction to the appropriate
 * state and enable the completion of in-progress burning transactions, however
 * RenVM will generally automatically complete asset releases once the burn
 * transaction has been submitted to the host chain.
 *
 * See `/demos/simpleBurn.ts` for example usage.
 */
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
                        { target: "destInitiated", cond: "isDestInitiated" },
                        { target: "srcConfirmed", cond: "isSrcConfirmed" },
                        { target: "srcSettling", cond: "isSrcSettling" },
                        { target: "creating" },
                    ],
                },
                meta: { test: async () => {} },
            },

            creating: {
                invoke: {
                    src: "burnCreator",
                    onDone: {
                        actions: [
                            assign({
                                tx: (ctx, evt) => ({ ...ctx.tx, ...evt.data }),
                            }),
                            "burnSpawner",
                        ],
                    },
                    onError: {
                        target: "createError",
                        actions: assign({
                            tx: (ctx, evt) => ({ ...ctx.tx, error: evt.data }),
                        }),
                    },
                },
                on: {
                    CREATED: "created",
                },

                meta: {
                    test: (_: void, state: any) => {
                        assert(
                            !Object.keys(state.context.tx.transactions).length
                                ? true
                                : false,
                            "Should not have a transaction",
                        );
                    },
                },
            },

            created: {
                on: {
                    // When we fail to submit to the host chain, we don't enter the
                    // settling state, so handle the error here
                    BURN_ERROR: {
                        target: "errorBurning",
                        actions: assign({
                            tx: (ctx, evt) =>
                                evt.data
                                    ? {
                                          ...ctx.tx,
                                          error: evt.data,
                                      }
                                    : ctx.tx,
                        }),
                    },

                    SUBMIT: {
                        actions: send("SUBMIT", {
                            to: (ctx) => {
                                return ctx.burnListenerRef?.id || "";
                            },
                        }),
                    },

                    SUBMITTED: {
                        target: "srcSettling",
                        actions: [
                            assign({
                                tx: (ctx, evt) => ({
                                    ...ctx.tx,
                                    transactions: {
                                        [evt.data.sourceTxHash]: evt.data,
                                    },
                                }),
                            }),
                        ],
                    },
                },

                meta: {
                    test: (_: void, state: any) => {
                        assert(
                            !Object.keys(state.context.tx.transactions).length
                                ? true
                                : false,
                            "Should not have a transaction",
                        );
                    },
                },
            },

            createError: {
                on: {
                    RETRY: "created",
                },
                meta: {
                    test: (_: void, state: any) => {
                        assert(
                            state.context.tx.error ? true : false,
                            "Error must exist",
                        );
                    },
                },
            },
            errorBurning: {
                meta: {
                    test: (_: void, state: any) => {
                        assert(
                            state.context.tx.error ? true : false,
                            "Error must exist",
                        );
                    },
                },
            },

            srcSettling: {
                // spawn in case we aren't creating
                entry: "burnSpawner",
                on: {
                    BURN_ERROR: {
                        target: "errorBurning",
                        actions: assign({
                            tx: (ctx, evt) =>
                                evt.data
                                    ? {
                                          ...ctx.tx,
                                          error: evt.data,
                                      }
                                    : ctx.tx,
                        }),
                    },

                    SUBMIT: {
                        actions: send("SUBMIT", {
                            to: (ctx) => {
                                return ctx.burnListenerRef?.id || "";
                            },
                        }),
                    },

                    CONFIRMATION: {
                        // update src confs
                        actions: assign({
                            tx: (ctx, evt) =>
                                evt.data
                                    ? {
                                          ...ctx.tx,
                                          transactions: {
                                              [evt.data.sourceTxHash]: evt.data,
                                          },
                                      }
                                    : ctx.tx,
                        }),
                    },
                    CONFIRMED: {
                        actions: [
                            assign({
                                tx: (ctx, evt) => ({
                                    ...ctx.tx,
                                    transactions: {
                                        [evt.data.sourceTxHash]: evt.data,
                                    },
                                }),
                            }),
                        ],
                        target: "srcConfirmed",
                    },
                },
                meta: {
                    test: (_: void, state: any) => {
                        assert(
                            Object.keys(state.context.tx.transactions).length
                                ? true
                                : false,
                            "Should have a transaction",
                        );
                    },
                },
            },

            errorReleasing: {
                meta: {
                    test: (_: void, state: any) => {
                        assert(
                            state.context.tx.error ? true : false,
                            "Error must exist",
                        );
                    },
                },
            },

            srcConfirmed: {
                on: {
                    RELEASE_ERROR: {
                        target: "errorReleasing",
                        actions: assign({
                            tx: (ctx, evt) =>
                                evt.data
                                    ? {
                                          ...ctx.tx,
                                          error: evt.data,
                                      }
                                    : ctx.tx,
                        }),
                    },
                    RELEASED: "destInitiated",
                },
                meta: {
                    test: (_: void, state: any) => {
                        assert(
                            getFirstTx(state.context.tx).sourceTxConfs >=
                                (getFirstTx(state.context.tx)
                                    .sourceTxConfTarget || 0)
                                ? true
                                : false,
                            "Should have a confirmed transaction",
                        );
                    },
                },
            },

            // FIXME: not currently used, but should be tracked once migrated to 0.3
            // accepted: {
            //     meta: { test: async () => {} },
            //},

            destInitiated: {
                meta: { test: async () => {} },
            },
        },
    },

    {
        guards: {
            isSrcSettling: (ctx, _evt) => {
                return getFirstTx(ctx.tx)?.sourceTxHash ? true : false;
            },
            isSrcConfirmed: (ctx, _evt) =>
                getFirstTx(ctx.tx)?.sourceTxConfs >=
                (getFirstTx(ctx.tx)?.sourceTxConfTarget ||
                    Number.POSITIVE_INFINITY),
            // We assume that the renVmHash implies that the dest tx has been initiated
            isDestInitiated: (ctx, _evt) => !!getFirstTx(ctx.tx)?.renVMHash,
            // FIXME: once we have migrated to 0.3 for all assets, actually check for
            // destTxHash
            // isDestInitiated: (ctx, _evt) => !!getFirstTx(ctx.tx)?.destTxHash,
        },
    },
);
