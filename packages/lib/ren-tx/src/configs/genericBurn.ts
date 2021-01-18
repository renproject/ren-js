/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import BigNumber from "bignumber.js";
import {
    Actor,
    assign,
    MachineOptions,
    Receiver,
    send,
    Sender,
    spawn,
} from "xstate";

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

const burnTransactionListener = (context: BurnMachineContext) => (
    callback: Sender<BurnMachineEvent>,
    receive: Receiver<any>,
) => {
    const cleaners: Array<() => void> = [];
    let burning = false;
    burnAndRelease(context)
        .then((burn) => {
            // Ready to recieve SUBMIT
            callback({ type: "CREATED" });
            if (context.autoSubmit) {
                setTimeout(() => callback("SUBMIT"), 500);
            }

            let tx: GatewayTransaction = Object.values(
                context.tx.transactions,
            )[0];
            const performBurn = async () => {
                // Only allow burn to be called once
                if (burning) return;
                burning = true;
                const burnRef = burn.burn();

                const burnListener = (confs: number) => {
                    callback({
                        type: "CONFIRMATION",
                        // FIXME: get proper confirmation target for burning somewhere
                        data: {
                            ...tx,
                            sourceTxConfs: confs,
                            sourceTxConfTarget: tx.sourceTxConfTarget || 6,
                        },
                    });
                };
                cleaners.push(() => {
                    burnRef._cancel();
                    burnRef.removeListener("confirmation", burnListener);
                });

                await burnRef
                    // host chain tx hash
                    .on("transactionHash", (txHash: string) => {
                        tx = {
                            sourceTxHash: txHash,
                            sourceTxConfs: 0,
                            sourceTxAmount: Number(context.tx.suggestedAmount),
                            rawSourceTx: {
                                amount: String(context.tx.suggestedAmount),
                                transaction: {},
                            },
                        };
                        callback({
                            type: "SUBMITTED",
                            data: {
                                ...tx,
                            },
                        });
                    })
                    .on("confirmation", burnListener)
                    .catch((error) =>
                        callback({ type: "BURN_ERROR", data: error }),
                    );

                const releaseListener = (status: string) => {
                    status === "confirming"
                        ? console.log(`confirming`)
                        : console.log("status", status);
                };

                const hashListener = (hash: string) => {
                    callback({
                        type: "CONFIRMED",
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
                    releaseRef.removeListener(
                        "transaction",
                        transactionListener,
                    );
                    releaseRef.removeListener("txHash", hashListener);
                });
                releaseRef.catch((e) => {
                    console.error("release error", e);
                    callback({ type: "RELEASE_ERROR", data: new Error(e) });
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
                    callback({ type: "RELEASE_ERROR", data: new Error(e) });
                }
            };

            receive((event: BurnMachineEvent) => {
                if (event.type === "SUBMIT") {
                    performBurn()
                        .then()
                        .catch((e) => {
                            console.error(e);
                            callback({ type: "BURN_ERROR", data: e });
                        });
                }
            });
        })
        .catch((e) => {
            console.error(e);

            callback({ type: "BURN_ERROR", data: e });
        });

    return () => {
        for (const cleaner of cleaners) {
            cleaner();
        }
    };
};

export const burnConfig: Partial<MachineOptions<
    BurnMachineContext,
    BurnMachineEvent
>> = {
    actions: {
        burnSpawner: spawnBurnTransaction,
    },
    services: {
        burnCreator: txCreator,
        burnListener: burnTransactionListener,
    },
};
