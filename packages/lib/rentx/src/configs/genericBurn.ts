/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import BigNumber from "bignumber.js";
import { assign, MachineOptions, Receiver, send, Sender, spawn } from "xstate";

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
        to: context.toChainMap[context.tx.destNetwork](context),
        from: context.fromChainMap[context.tx.sourceNetwork](context),
        ...(transaction ? { transaction } : {}),
    });
};

// Format a transaction and prompt the user to sign
const txCreator = async (
    context: BurnMachineContext,
    // eslint-disable-next-line @typescript-eslint/require-await
): Promise<GatewaySession> => {
    const {
        targetAmount,
        sourceAsset,
        sourceNetwork,
        destNetwork,
    } = context.tx;
    const to = context.toChainMap[destNetwork](context);
    const from = context.fromChainMap[sourceNetwork](context);
    const decimals = await to.assetDecimals(sourceAsset.toUpperCase());

    let suggestedAmount = new BigNumber(Number(targetAmount) * 10 ** decimals);
    try {
        const fees = await context.sdk.getFees({
            asset: sourceAsset.toUpperCase(),
            from,
            to,
        });

        suggestedAmount = suggestedAmount
            .plus(fees.release || 0)
            .plus(suggestedAmount.multipliedBy(fees.burn * 0.001));
    } catch (error) {
        // Ignore error
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
        return spawn(cb, actorName);
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
                        data: { ...tx, sourceTxConfs: confs },
                    });
                };
                cleaners.push(() => {
                    burnRef._cancel();
                    burnRef.removeListener("confirmation", burnListener);
                });

                await burnRef
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
                        data: { ...tx, destTxHash: hash },
                    });
                };

                const releaseRef = burn.release();
                cleaners.push(() => {
                    releaseRef._cancel();
                    releaseRef.removeListener("status", releaseListener);
                    releaseRef.removeListener("txHash", hashListener);
                });

                await releaseRef
                    .on("status", releaseListener)
                    .on("txHash", hashListener)
                    .catch((error) =>
                        callback({ type: "RELEASE_ERROR", data: error }),
                    );
            };

            receive((event: BurnMachineEvent) => {
                if (event.type === "SUBMIT") {
                    performBurn().then().catch(console.error);
                }
            });
        })
        .catch(console.error);

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
