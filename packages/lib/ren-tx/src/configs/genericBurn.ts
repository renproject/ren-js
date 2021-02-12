/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import { DepositCommon } from "@renproject/interfaces";
import {
    BurnAndRelease,
    BurnAndReleaseStatus,
} from "@renproject/ren/build/main/burnAndRelease";
import BigNumber from "bignumber.js";
import { Actor, assign, MachineOptions, Receiver, Sender, spawn } from "xstate";

import { BurnMachineContext, BurnMachineEvent } from "../machines/burn";
import { GatewaySession, GatewayTransaction } from "../types/transaction";

/*
Sample burnChainMap / releaseChainMap implementations
We don't implement these to prevent mandating specific chains

const burnChainMap: BurnMachineContext["fromChainMap"] = {
    ethereum: (context): MintChain<any> => {
        return Ethereum(context.providers.ethereum, RenNetwork.Testnet).Account(
            {
                address: context.tx.userAddress,
                value: context.tx.suggestedAmount,
            }
        ) as MintChain<any>;
    },
};

const releaseChainMap: BurnMachineContext["toChainMap"] = {
    bitcoin: (context): LockChain => {
        return Bitcoin().Address(context.tx.destAddress) as any;
    },
};
*/

const burnAndRelease = async (context: BurnMachineContext) => {
    const transaction = Object.keys(context.tx.transactions)[0];
    return await context.sdk.burnAndRelease({
        asset: context.tx.sourceAsset.toUpperCase(),
        to: context.toChainMap[context.tx.destChain](context),
        from: context.fromChainMap[context.tx.sourceChain](context),
        ...(transaction ? { transaction } : {}),
    });
};

// Format a transaction and prompt the user to sign
const txCreator = async (
    context: BurnMachineContext,
    // eslint-disable-next-line @typescript-eslint/require-await
): Promise<GatewaySession> => {
    const { targetAmount, sourceAsset, sourceChain, destChain } = context.tx;
    const to = context.toChainMap[destChain](context);
    const from = context.fromChainMap[sourceChain](context);
    const decimals = await to.assetDecimals(sourceAsset.toUpperCase());

    let suggestedAmount = new BigNumber(targetAmount).times(
        new BigNumber(10).exponentiatedBy(decimals),
    );

    if (context.autoFees) {
        // This will throw and be caught by the machine if we fail to get fees
        // If the user specifies that they want to have fees added,
        // we should not silently fail, as they will not recieve the amount
        // they expected
        const fees = await context.sdk.getFees({
            asset: sourceAsset.toUpperCase(),
            from,
            to,
        });

        suggestedAmount = suggestedAmount
            .plus(fees.release || 0)
            .plus(suggestedAmount.multipliedBy(fees.burn * 0.001));
    }

    const newTx: GatewaySession = {
        ...context.tx,
        suggestedAmount: suggestedAmount.decimalPlaces(0).toFixed(),
    };
    context.tx = newTx;

    return {
        ...newTx,
        transactions: {},
    };
};

const spawnBurnTransaction = assign<BurnMachineContext, BurnMachineEvent>({
    burnListenerRef: (c: BurnMachineContext, _e: any) => {
        const actorName = `${c.tx.id}BurnListener`;
        if (c.burnListenerRef) {
            console.warn("listener already exists");
            return c.burnListenerRef;
        }
        const cb = burnTransactionListener(c);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        return spawn(cb, actorName) as Actor<any>;
    },
});

const performBurn = async (
    burn: BurnAndRelease<any, DepositCommon<any>, any, any>,
    callback: Sender<BurnMachineEvent>,
    cleaners: Array<() => void>,
    tx: GatewayTransaction,
) => {
    // will resume from previous tx if we have the hash
    const burnRef = burn.burn();

    const burnListener = async (
        confs: number /* actually eth tx target: number */,
    ) => {
        const target = await burn.confirmationTarget();
        // We need to wait for burn details to resolve, which
        // might not be ready even if we have sufficient confirmations
        if (confs >= target && burn.burnDetails) {
            // stop listening for confirmations once confirmed
            burnRef.removeListener("confirmation", burnListener);

            callback({
                type: "CONFIRMED",
                data: { ...tx, sourceTxConfs: confs },
            });
        } else {
            callback({
                type: "CONFIRMATION",
                data: {
                    ...tx,
                    sourceTxConfs: confs,
                    sourceTxConfTarget: target,
                },
            });
        }
    };

    cleaners.push(() => {
        burnRef._cancel();
        burnRef.removeListener("confirmation", burnListener);
    });

    try {
        const r = await burnRef
            // host chain tx hash
            .on("transactionHash", (txHash: string) => {
                tx.sourceTxHash = txHash;
                tx.sourceTxConfs = 0;
                callback({
                    type: "SUBMITTED",
                    data: {
                        ...tx,
                    },
                });
            })
            .on("confirmation", burnListener);

        if (tx) {
            // ensure we have a target
            const target =
                tx.sourceTxConfTarget || (await burn.confirmationTarget());
            // the burn status is canonical, we should proceed if
            // it says we have burned
            if (r.status == BurnAndReleaseStatus.Burned) {
                tx.sourceTxConfs = target;
            }

            // Always call because we won't get an emission
            // if the burn is already done
            burnListener(tx.sourceTxConfs);
        }
    } catch (error) {
        throw error;
    }
};

const performRelease = async (
    burn: BurnAndRelease<any, DepositCommon<any>, any, any>,
    callback: Sender<BurnMachineEvent>,
    cleaners: Array<() => void>,
    tx: GatewayTransaction,
) => {
    // Only start processing release once confirmed
    // Release from renvm status
    const releaseListener = (status: string) => {
        status === "confirming"
            ? console.debug(`confirming`)
            : console.debug("status", status);
    };

    // renvm hash status
    const hashListener = (hash: string) => {
        callback({
            type: "ACCEPTED",
            data: { ...tx, renVMHash: hash },
        });
    };

    const transactionListener = (transaction: any) => {
        callback({
            type: "RELEASED",
            data: {
                ...tx,
                destTxHash: transaction.hash,
                // Can be used to construct blockchain explorer link
                rawDestTx: transaction,
            },
        });
    };

    const releaseRef = burn.release();
    cleaners.push(() => {
        releaseRef._cancel();
        releaseRef.removeListener("status", releaseListener);
        releaseRef.removeListener("transaction", transactionListener);
        releaseRef.removeListener("txHash", hashListener);
    });

    releaseRef.catch((e) => {
        console.error("release error", e);
        callback({
            type: "RELEASE_ERROR",
            data: e.toString(),
        });
    });

    try {
        const res = await releaseRef
            .on("status", releaseListener)
            .on("transaction", transactionListener)
            .on("txHash", hashListener);
        callback({
            type: "RELEASED",
            data: { ...tx, renResponse: res },
        });
    } catch (e) {
        callback({
            type: "RELEASE_ERROR",
            data: e.toString(),
        });
    }
};

const burnTransactionListener = (context: BurnMachineContext) => (
    callback: Sender<BurnMachineEvent>,
    receive: Receiver<any>,
) => {
    const cleaners: Array<() => void> = [];
    let burning = false;
    burnAndRelease(context)
        .then(async (burn) => {
            // Ready to recieve SUBMIT
            callback({ type: "CREATED" });
            if (
                context.autoSubmit ||
                // Alway "SUBMIT" if we have submitted previously
                Object.keys(context.tx.transactions).length > 0
            ) {
                setTimeout(() => callback("SUBMIT"), 500);
            }

            const tx: GatewayTransaction =
                Object.values(context.tx.transactions)[0] || {};

            tx.sourceTxConfTarget = await burn.confirmationTarget();
            tx.sourceTxAmount = Number(context.tx.suggestedAmount);
            tx.rawSourceTx = {
                amount: String(context.tx.suggestedAmount),
                transaction: {},
            };

            receive((event: BurnMachineEvent) => {
                if (event.type === "SUBMIT") {
                    // Only burn once
                    if (burning) {
                        return;
                    }
                    burning = true;
                    performBurn(burn, callback, cleaners, tx)
                        .then()
                        .catch((e) => {
                            console.error(e);
                            callback({
                                type: "BURN_ERROR",
                                data: e.toString(),
                            });
                        });
                }

                if (event.type === "RELEASE") {
                    performRelease(burn, callback, cleaners, tx)
                        .then()
                        .catch((e) => {
                            console.error(e);
                            callback({
                                type: "BURN_ERROR",
                                data: e.toString(),
                            });
                        });
                }
            });
        })
        .catch((e) => {
            console.error(e);

            callback({ type: "BURN_ERROR", data: e.toString() });
        });

    return () => {
        for (const cleaner of cleaners) {
            cleaner();
        }
    };
};

export const burnConfig: Partial<
    MachineOptions<BurnMachineContext, BurnMachineEvent>
> = {
    actions: {
        burnSpawner: spawnBurnTransaction,
    },
    services: {
        burnCreator: txCreator,
        burnListener: burnTransactionListener,
    },
};
