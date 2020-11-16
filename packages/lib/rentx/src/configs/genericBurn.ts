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
    const txHash = Object.keys(context.tx.transactions)[0];
    return await context.sdk.burnAndRelease({
        asset: context.tx.sourceAsset.toUpperCase(),
        to: context.toChainMap[context.tx.destNetwork](context),
        from: context.fromChainMap[context.tx.sourceNetwork](context),
        ...(txHash ? { txHash } : {}),
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
    const decimals = await context.toChainMap[destNetwork](
        context,
    ).assetDecimals(sourceAsset.toUpperCase());

    const suggestedAmount = new BigNumber(Number(targetAmount) * 10 ** decimals)
        .decimalPlaces(0)
        .toFixed();
    try {
        // TODO: Pass lock and mint chains to getFees.
        // const asset = context.tx.sourceAsset;
        // const fees = await context.sdk.getFees();
        // const fee: number = fees.release;
        // suggestedAmount = new BigNumber(
        //     Math.floor(fee + Number(context.tx.targetAmount) * 1e8),
        // )
        //     .decimalPlaces(0)
        //     .toFixed();
    } catch (error) {
        // Ignore error
    }

    const newTx: GatewaySession = {
        ...context.tx,
        suggestedAmount,
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
    burnAndRelease(context)
        .then((burn) => {
            if (context.autoSubmit) {
                setTimeout(() => callback("SUBMIT"), 500);
            }

            let tx: GatewayTransaction;
            const performBurn = async () => {
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
