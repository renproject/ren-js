/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import { Actor, assign, Machine, send } from "xstate";
import RenJS from "@renproject/ren";
import { LockChain, MintChain } from "@renproject/interfaces";
import { assert } from "@renproject/utils";

import {
    BurnSession,
    BurnTransaction,
    CompletedBurnTransaction,
    ConfirmedBurnTransaction,
    ErroringBurnSession,
    ReleasedBurnTransaction,
    isBurnConfirmed,
    isReleased,
} from "../types/burn";
import { LockChainMap, MintChainMap } from "./mint";

export interface BurnMachineContext<BurnType, ReleaseType> {
    /**
     * The TX to be processed
     */
    tx: BurnSession<BurnType, ReleaseType> | ErroringBurnSession<BurnType>;
    sdk: RenJS;
    /**
     * Automatically request burn submission to the host chain provider
     * (eg. will prompt web3 tx dialog after starting machine)
     */
    autoSubmit?: boolean;

    /**
     * Function to create the "from" param;
     */
    from: (
        context: BurnMachineContext<BurnType, ReleaseType>,
    ) => MintChain<BurnType>;

    /**
     * Function to create the "to" RenJS param;
     */
    to: (
        context: BurnMachineContext<BurnType, ReleaseType>,
    ) => LockChain<ReleaseType>;

    /**
     * @private
     * Tracks the RenJS BurnAndRelease callback
     */
    burnListenerRef?: Actor<any>;
}

export enum BurnStates {
    /** Tx is resolving which state it should be in based on feedback from renjs */
    RESTORE = "restoring",

    /** Tx is being initialized by renjs */
    CREATING = "creating",

    /** Tx has been initialized by renjs successfully and is ready to be submitted*/
    CREATED = "created",

    /** Burn has been submitted to host chain */
    SUBMITTING_BURN = "submittingBurn",

    /** Source/host chain is awaiting sufficient confirmations */
    CONFIRMING_BURN = "srcSettling",

    /** There was an error encountered while processing the burn tx
     * Could be either from renvm or the host chain */
    ERROR_BURNING = "errorBurning",

    /** Source/host chain has reached sufficient confirmations and tx
     * can be submitted to renVM for release */
    RENVM_RELEASING = "srcConfirmed",

    /** RenVM has recieved the tx and provided a hash */
    RENVM_ACCEPTED = "accepted",

    /** An error occored while processing the release
     * Should only come from renVM */
    ERROR_RELEASING = "errorReleasing",

    /** The release tx has successfully been broadcast
     * For network v0.3+ we get the release destTxHash
     * otherwise it will never be provided
     */
    RELEASED = "destInitiated",
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

        /** Burn has been submitted to host chain */
        submittingBurn: {};

        /** Source/host chain is awaiting sufficient confirmations */
        srcSettling: {};

        /** There was an error encountered while processing the burn tx
         * Could be either from renvm or the host chain */
        errorBurning: {};

        /** Source/host chain has reached sufficient confirmations and tx
         * can be submitted to renVM for release */
        srcConfirmed: {};

        /** RenVM has recieved the tx and provided a hash */
        accepted: {};

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

export type BurnMachineEvent<X, Y> =
    | { type: "NOOP" }
    | { type: "RETRY" }
    | { type: "RESTORE" }
    | { type: "CREATED" }
    // Submit to renvm
    | { type: "SUBMIT" }
    // Burn Submitted
    | { type: "SUBMITTED"; data: BurnTransaction }
    | { type: "RELEASE" }
    | { type: "RELEASE_ERROR"; data: Partial<BurnTransaction>; error: Error }
    | { type: "BURN_ERROR"; data: Partial<BurnSession<X, Y>>; error: Error }
    | { type: "CONFIRMATION"; data: BurnTransaction }
    | { type: "CONFIRMED"; data: BurnTransaction }
    | { type: "ACCEPTED"; data: ConfirmedBurnTransaction<X> }
    | { type: "RELEASED"; data: ReleasedBurnTransaction<X> }
    | { type: "COMPLETED"; data: CompletedBurnTransaction<X, Y> };

type extractBurnTx<Type> = Type extends MintChain<infer X> ? X : never;
type extractReleaseTx<Type> = Type extends LockChain<infer X> ? X : never;

export const buildBurnContextWithMap = <BurnType, ReleaseType>(params: {
    tx: BurnSession<BurnType, ReleaseType>;
    sdk: RenJS;

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
    toChainMap: LockChainMap<BurnMachineContext<BurnType, ReleaseType>>;

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
    fromChainMap: MintChainMap<BurnMachineContext<BurnType, ReleaseType>>;
}) => {
    const from = params.fromChainMap[params.tx.sourceChain];
    const to = params.toChainMap[params.tx.destChain];
    const constructed: BurnMachineContext<
        extractBurnTx<ReturnType<typeof from>>,
        extractReleaseTx<ReturnType<typeof to>>
    > = {
        tx: params.tx,
        to,
        sdk: params.sdk,
        from,
    };
    return constructed;
};

/**
 * An Xstate machine that, when given a serializable [[BurnSession]] tx,
 * will instantiate a RenJS BurnAndRelease session, prompt the user to submit a
 * burn transaction (or automatically submit if the `autoSubmit` flag is set),
 * on the host chain, listen for confirmations, and detect the release transaction
 * once the native asset has been released.
 *
 * Given the same [[BurnSession]] parameters, as long as the tx has not
 * expired, the machine will restore the transaction to the appropriate
 * state and enable the completion of in-progress burning transactions, however
 * RenVM will generally automatically complete asset releases once the burn
 * transaction has been submitted to the host chain.
 *
 * See `/demos/simpleBurn.ts` for example usage.
 */
export const buildBurnMachine = <BurnType, ReleaseType>() =>
    Machine<
        BurnMachineContext<BurnType, ReleaseType>,
        BurnMachineSchema,
        BurnMachineEvent<BurnType, ReleaseType>
    >(
        {
            id: "RenVMBurnMachine",
            initial: "restoring",
            states: {
                restoring: {
                    entry: send("RESTORE"),
                    on: {
                        RESTORE: [
                            {
                                target: "destInitiated",
                                cond: "isDestInitiated",
                            },
                            // We can't restore to this state, because the machine needs
                            // to be initialized
                            // { target: "srcConfirmed", cond: "isSrcConfirmed" },
                            { target: "srcSettling", cond: "isSrcSettling" },
                            { target: "creating" },
                        ],
                    },
                    meta: { test: async () => {} },
                },

                creating: {
                    entry: "burnSpawner",
                    on: {
                        CREATED: "created",
                    },

                    meta: {
                        test: (_: void, state: any) => {
                            assert(
                                !state.context.tx.transaction ? true : false,
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
                            target: BurnStates.SUBMITTING_BURN,
                            actions: send("SUBMIT", {
                                to: (ctx) => {
                                    return ctx.burnListenerRef?.id || "";
                                },
                            }),
                        },
                    },

                    meta: {
                        test: (_: void, state: any) => {
                            assert(
                                !state.context.tx.transaction ? true : false,
                                "Should not have a transaction",
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

                submittingBurn: {
                    on: {
                        BURN_ERROR: {
                            target: "errorBurning",
                            actions: assign({
                                tx: (ctx, evt) =>
                                    evt.data
                                        ? {
                                              ...ctx.tx,
                                              error: evt.error,
                                          }
                                        : ctx.tx,
                            }),
                        },
                        SUBMITTED: {
                            actions: [
                                assign({
                                    tx: (ctx, evt) => ({
                                        ...ctx.tx,
                                        transaction: evt.data,
                                    }),
                                }),
                            ],
                        },
                        // Wait for a confirmation before entering confirming
                        CONFIRMATION: {
                            target: "srcSettling",
                            // update src confs
                            actions: assign({
                                tx: (ctx, evt) => ({
                                    ...ctx.tx,
                                    transaction: evt.data,
                                }),
                            }),
                        },
                    },
                    meta: {
                        test: (_: void, state: any) => {
                            assert(
                                state.context.tx.error ? false : true,
                                "Error must not exist",
                            );
                        },
                    },
                },

                srcSettling: {
                    // spawn in case we aren't creating
                    entry: "burnSpawner",
                    on: {
                        // In case we restored and didn't submit
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
                                tx: (ctx, evt) => ({
                                    ...ctx.tx,
                                    transaction: evt.data,
                                }),
                            }),
                        },
                        CONFIRMED: {
                            actions: [
                                assign({
                                    tx: (ctx, evt) => ({
                                        ...ctx.tx,
                                        transaction: evt.data,
                                    }),
                                }),
                            ],
                            target: "srcConfirmed",
                        },
                    },
                    meta: {
                        test: (_: void, state: any) => {
                            assert(
                                Object.keys(state.context.tx.transaction).length
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
                    entry: send("RELEASE", {
                        to: (ctx) => {
                            return ctx.burnListenerRef?.id || "";
                        },
                    }),
                    on: {
                        RELEASE_ERROR: {
                            target: "errorReleasing",
                            actions: assign({
                                tx: (ctx, evt) =>
                                    evt.data
                                        ? {
                                              ...ctx.tx,
                                              error: evt.error,
                                          }
                                        : ctx.tx,
                            }),
                        },
                        ACCEPTED: {
                            actions: [
                                assign({
                                    tx: (ctx, evt) => ({
                                        ...ctx.tx,
                                        transaction: evt.data,
                                    }),
                                }),
                            ],
                            target: "accepted",
                        },
                    },
                    meta: {
                        test: (_: void, state: any) => {
                            assert(
                                state.context.tx.transaction.sourceTxConfs >=
                                    (state.context.tx.transaction
                                        .sourceTxConfTarget || 0)
                                    ? true
                                    : false,
                                "Should have a confirmed transaction",
                            );
                        },
                    },
                },

                accepted: {
                    on: {
                        RELEASE_ERROR: {
                            target: "errorReleasing",
                            actions: assign({
                                tx: (ctx, evt) =>
                                    evt.data
                                        ? {
                                              ...ctx.tx,
                                              error: evt.error,
                                          }
                                        : ctx.tx,
                            }),
                        },
                        RELEASED: {
                            target: "destInitiated",
                            actions: assign({
                                tx: (ctx, evt) => ({
                                    ...ctx.tx,
                                    transaction: evt.data,
                                }),
                            }),
                        },
                    },
                    meta: { test: async () => {} },
                },

                destInitiated: {
                    meta: {
                        test: (_: void, state: any) => {
                            assert(
                                state.context.tx.transaction.renResponse
                                    ? true
                                    : false,
                                "renResponse must exist",
                            );
                        },
                    },
                },
            },
        },

        {
            guards: {
                isSrcSettling: (ctx, _evt) => {
                    return ctx.tx.transaction && ctx.tx.transaction.sourceTxHash
                        ? true
                        : false;
                },
                isSrcConfirmed: (ctx, _evt) =>
                    !!ctx.tx.transaction &&
                    ctx.tx.transaction.sourceTxConfs >=
                        (ctx.tx.transaction.sourceTxConfTarget ||
                            Number.POSITIVE_INFINITY),
                // We assume that the renVmHash implies that the dest tx has been initiated
                isDestInitiated: (ctx, _evt) =>
                    !!ctx.tx.transaction &&
                    isReleased(ctx.tx.transaction) &&
                    !!ctx.tx.transaction.renResponse,
                // FIXME: once we have migrated to 0.3 for all assets, actually check for
                // destTxHash
                // isDestInitiated: (ctx, _evt) => !!getFirstTx(ctx.tx)?.destTxHash,
            },
        },
    );
