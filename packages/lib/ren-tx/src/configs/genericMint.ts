/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Improve typings.

import { DepositCommon, LockAndMintTransaction } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import {
    DepositStatus,
    LockAndMint,
    LockAndMintDeposit,
} from "@renproject/ren/build/main/lockAndMint";
import BigNumber from "bignumber.js";
import {
    Actor,
    assign,
    MachineOptions,
    Receiver,
    Sender,
    spawn,
    send,
    actions,
} from "xstate";
import { TransactionReceipt } from "web3-core";

import { depositMachine, DepositMachineContext } from "../machines/deposit";
import { GatewayMachineContext, GatewayMachineEvent } from "../machines/mint";
import { GatewaySession, GatewayTransaction } from "../types/transaction";

/*
  Sample mintChainMap / lockChainMap implementations
  We don't implement these to prevent mandating specific chains

const mintChainMap: {
    [key in string]: (c: GatewayMachineContext) => MintChain<any>;
} = {
    binanceSmartChain: (context: GatewayMachineContext) => {
        const { destAddress, destNetwork } = context.tx;
        const { providers } = context;
        return new BinanceSmartChain(providers[destNetwork]).Account({
            address: destAddress,
        }) as MintChain<any>;
    },
    ethereum: (context: GatewayMachineContext): MintChain => {
        const { destAddress, destNetwork } = context.tx;
        const { providers } = context;

        return Ethereum(providers[destNetwork]).Account({
            address: destAddress,
        }) as MintChain<any>;
    },
};

const lockChainMap = {
    bitcoin: () => Bitcoin(),
    zcash: () => Zcash(),
    bitcoinCash: () => BitcoinCash(),
};
*/

// Recursively cast all buffers in an object to hex
const hexify = (obj: { [key: string]: any }) => {
    if (!obj) return;
    const entries = Object.entries(obj);
    for (const [k, v] of entries) {
        if (Buffer.isBuffer(v)) {
            obj[k] = v.toString("hex");
        }
    }
    return obj;
};

// Create a LockAndMint instance from a RenTX context
export const renLockAndMint = async (context: GatewayMachineContext) => {
    const { nonce, destChain, sourceChain, sourceAsset } = context.tx;
    const { sdk, fromChainMap, toChainMap } = context;

    const mint = await sdk.lockAndMint({
        asset: sourceAsset.toUpperCase(),
        from: fromChainMap[sourceChain](context),
        to: toChainMap[destChain](context),
        nonce,
    });

    return mint;
};

// Format a transaction and get the gateway address
const txCreator = async (context: GatewayMachineContext) => {
    // TX may be in a state where the gateway address was provided,
    // but no deposit was picked up
    if (!context.tx.nonce) {
        context.tx.nonce = RenJS.utils.randomNonce().toString("hex");
    }

    const { targetAmount, sourceAsset, sourceChain, destChain } = context.tx;

    const to = context.toChainMap[destChain](context);
    const from = context.fromChainMap[sourceChain](context);

    const decimals = await from.assetDecimals(sourceAsset.toUpperCase());

    let suggestedAmount = new BigNumber(targetAmount).times(
        new BigNumber(10).exponentiatedBy(decimals),
    );

    if (context.autoFees) {
        // This will throw and be caught by the machine if we fail to get fees
        // If the user specifies that they want to have fees added,
        // we should not silently fail, as they will be prompted to deposit
        // an incorrect amount

        const fees = await context.sdk.getFees({
            asset: sourceAsset.toUpperCase(),
            from,
            to,
        });

        suggestedAmount = suggestedAmount
            .plus(fees.lock || 0)
            .plus(suggestedAmount.multipliedBy(fees.mint * 0.001));
    }

    const minter = await renLockAndMint(context);
    const gatewayAddress = minter?.gatewayAddress;
    const newTx: GatewaySession = {
        ...context.tx,
        suggestedAmount: suggestedAmount.decimalPlaces(0).toFixed(),
        gatewayAddress,
    };
    return newTx;
};

const initMinter = async (
    context: GatewayMachineContext,
    callback: Sender<GatewayMachineEvent>,
) => {
    const minter = await renLockAndMint(context);

    if (minter.gatewayAddress != context.tx.gatewayAddress) {
        callback({
            type: "ERROR_LISTENING",
            data: new Error(
                `Incorrect gateway address ${String(
                    minter.gatewayAddress,
                )} != ${context.tx.gatewayAddress}`,
            ),
        });
    }
    return minter;
};

const handleSettle = async (
    sourceTxHash: string,
    deposit: LockAndMintDeposit,
    callback: Sender<any>,
) => {
    try {
        const res = await deposit
            .confirmed()
            .on("target", (targetConfs) => {
                const confirmedTx = {
                    sourceTxHash,
                    sourceTxConfs: 0,
                    sourceTxConfTarget: targetConfs,
                };
                callback({
                    type: "CONFIRMATION",
                    data: confirmedTx,
                });
            })
            .on("confirmation", (confs, targetConfs) => {
                const confirmedTx = {
                    sourceTxHash,
                    sourceTxConfs: confs,
                    sourceTxConfTarget: targetConfs,
                };
                callback({
                    type: "CONFIRMATION",
                    data: confirmedTx,
                });
            });

        callback({
            type: "CONFIRMED",
            data: {
                sourceTxConfTarget: res._state.targetConfirmations,
                sourceTxConfs: res._state.targetConfirmations,
                sourceTxHash,
            },
        });
    } catch (e) {
        callback({
            type: "ERROR",
            data: {
                sourceTxHash,
            },
            error: e,
        });
    }
};

// Handle signing on RenVM
const handleSign = async (
    sourceTxHash: string,
    deposit: LockAndMintDeposit,
    callback: Sender<any>,
) => {
    try {
        const v = await deposit
            .signed()
            .on("status", (state) => console.debug(state));

        if (!v._state.queryTxResult || !v._state.queryTxResult.out) {
            callback({
                type: "SIGN_ERROR",
                data: {
                    sourceTxHash,
                },
                error: new Error("No signature!").toString(),
            });
            return;
        }
        if (
            (v._state.queryTxResult.out &&
                v._state.queryTxResult.out.revert !== undefined) ||
            v.revertReason
        ) {
            deposit.revertReason;
            callback({
                type: "REVERTED",
                data: {
                    sourceTxHash,
                },
                error:
                    v._state.queryTxResult.out.revert?.toString() ||
                    v.revertReason ||
                    "",
            });
            return;
        } else {
            callback({
                type: "SIGNED",
                data: {
                    sourceTxHash,
                    renResponse: hexify(v._state.queryTxResult.out),
                    signature: v._state.queryTxResult.out.signature?.toString(
                        "hex",
                    ),
                },
            });
        }
    } catch (e) {
        // If error was due to revert - enter reverted state
        if (deposit.revertReason) {
            callback({
                type: "REVERTED",
                data: {
                    sourceTxHash,
                },
                error: deposit.revertReason,
            });
            return;
        }

        // If a tx has already been minted, we will get an error at this step
        // We can assume that a "utxo spent" error implies that the asset has been minted
        callback({
            type: "SIGN_ERROR",
            data: {
                sourceTxHash,
            },
            // Error must be stringified because full log breaks xstate serialization
            error: e.toString(),
        });
    }
};

// Handle minting on destination chain
const handleMint = async (
    sourceTxHash: string,
    deposit: LockAndMintDeposit,
    callback: Sender<any>,
    params: any,
) => {
    try {
        const minter = deposit.mint(params);

        const onConfirmation = (_: void, receipt: TransactionReceipt) => {
            const submittedTx = {
                sourceTxHash,
            };
            if (receipt.status == false) {
                callback({
                    type: "SUBMIT_ERROR",
                    data: { sourceTxHash },
                    error: "Transaction was reverted",
                });
            } else {
                callback({
                    type: "ACKNOWLEDGE",
                    data: submittedTx,
                });
            }

            // only acknowledge once
            minter.removeListener("confirmation", onConfirmation);
        };

        await minter.on("transactionHash", (transactionHash) => {
            const submittedTx = {
                sourceTxHash,
                destTxHash: transactionHash,
            };
            callback({
                type: "SUBMITTED",
                data: submittedTx,
            });
        });

        await minter.on("confirmation", onConfirmation);
        await minter;
    } catch (e) {
        callback({
            type: "SUBMIT_ERROR",
            data: { sourceTxHash },
            error: e,
        });
    }
};

const mintFlow = (
    context: GatewayMachineContext,
    callback: Sender<GatewayMachineEvent>,
    receive: Receiver<any>,
    minter: LockAndMint<any, DepositCommon<any>, any, any, any>,
) => {
    const deposits = new Map<string, LockAndMintDeposit>();

    const depositHandler = (deposit: LockAndMintDeposit) => {
        const txHash = deposit.params.from.transactionID(
            deposit.depositDetails.transaction,
        );

        const trackedDep = deposits.get(txHash);
        // if we have previously detected the deposit,
        // don't emit an event
        if (trackedDep) {
            return;
        }

        const persistedTx = context.tx.transactions[txHash];

        const rawSourceTx = deposit.depositDetails;
        const depositState: GatewayTransaction = persistedTx
            ? persistedTx
            : {
                  sourceTxHash: txHash,
                  renVMHash: deposit.txHash(),
                  renResponse: hexify(
                      deposit._state.queryTxResult || {},
                  ) as LockAndMintTransaction,
                  sourceTxAmount: parseInt(rawSourceTx.amount),
                  sourceTxConfs:
                      0 || parseInt(rawSourceTx.transaction.confirmations),
                  rawSourceTx,
                  destTxHash: deposit?.mintTransaction,
                  detectedAt: new Date().getTime(),
              };

        if (deposit.status === DepositStatus.Submitted) {
            // we don't actually know when the tx completed,
            // so assume it is now
            depositState.completedAt = Date.now();
        }

        if (!persistedTx) {
            callback({
                type: "DEPOSIT",
                data: { ...depositState },
            });
        } else {
            deposits.set(txHash, deposit);
            callback({ type: "RESTORED", data: depositState });
        }
    };

    minter.on("deposit", depositHandler);

    receive((event) => {
        const deposit = deposits.get(event.hash);
        if (!deposit) {
            // This can happen when restoring, and is not an error
            // callback({
            //     type: "ERROR",
            //     data: event.data,
            //     error: new Error(`missing deposit!: ${String(event.hash)}`),
            // });
            return;
        }

        const handle = async () => {
            switch (event.type) {
                case "SETTLE":
                    await handleSettle(event.hash, deposit, callback);
                    break;
                case "SIGN":
                    await handleSign(event.hash, deposit, callback);
                    break;
                case "MINT":
                    await handleMint(
                        event.hash,
                        deposit,
                        callback,
                        event.params,
                    );
                    break;
            }
        };

        handle()
            .then()
            .catch((e) =>
                callback({
                    type: "ERROR",
                    data: event.data,
                    error: e,
                }),
            );
    });

    receive((event) => {
        switch (event.type) {
            case "RESTORE":
                minter
                    .processDeposit(event.data.rawSourceTx)
                    .then((r) => {
                        // Previously the on('deposit') event would have fired when restoring
                        // Now, we use the promise result to set up the handler as well in
                        // case the `deposit` event does not fire
                        depositHandler(r);
                    })
                    .catch((e) => {
                        if (context.tx.transactions[event.data.renVMHash]) {
                            callback({
                                type: "ERROR",
                                data: event.data,
                                error: e,
                            });
                        } else {
                            throw e;
                        }
                    });
                break;
        }
    });
};

// Listen for confirmations on the source chain
const depositListener = (context: GatewayMachineContext) => (
    callback: Sender<GatewayMachineEvent>,
    receive: Receiver<any>,
) => {
    let cleanup = () => {};

    initMinter(context, callback)
        .then((minter) => {
            cleanup = () => minter.removeAllListeners();
            mintFlow(context, callback, receive, minter);
            callback({ type: "LISTENING" });
        })
        .catch((e) => {
            callback({ type: "ERROR_LISTENING", data: e });
        });

    return () => {
        cleanup();
    };
};

// Spawn an actor that will listen for either all deposits to a gatewayAddress,
// or to a single deposit if present in the context
const listenerAction = assign<GatewayMachineContext>({
    depositListenerRef: (c: GatewayMachineContext, _e: any) => {
        const actorName = `${c.tx.id}SessionListener`;
        if (c.depositListenerRef) {
            console.warn("listener already exists");
            return c.depositListenerRef;
        }
        const cb = depositListener(c);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        return spawn(cb, actorName) as Actor<any>;
    },
});

const spawnDepositMachine = (
    machineContext: DepositMachineContext,
    name: string,
) =>
    spawn(
        depositMachine.withContext(machineContext).withConfig({
            actions: {
                listenerAction: listenerAction as any,
            },
        }),
        {
            sync: true,
            name,
        },
    );

export const mintConfig: Partial<MachineOptions<GatewayMachineContext, any>> = {
    services: {
        txCreator,
        depositListener,
    },
    actions: {
        broadcast: actions.pure((ctx, event) => {
            return Object.values(ctx.depositMachines || {}).map((m) =>
                send(event, { to: m.id }),
            );
        }),

        forwardEvent: send(
            (_, b) => {
                return b;
            },
            {
                to: (_ctx: GatewayMachineContext) => "depositListener",
            },
        ),

        routeEvent: send(
            (_, b) => {
                return b;
            },
            {
                to: (
                    ctx: GatewayMachineContext,
                    evt: { type: string; data: { sourceTxHash: string } },
                ) => {
                    const machines = ctx.depositMachines || {};
                    return machines[evt.data.sourceTxHash]?.id || "missing";
                },
            },
        ),

        spawnDepositMachine: assign({
            depositMachines: (context, evt) => {
                const machines = context.depositMachines || {};
                if (machines[evt.data?.sourceTxHash] || !evt.data) {
                    return machines;
                }

                machines[evt.data.sourceTxHash] = spawnDepositMachine(
                    { deposit: evt.data },
                    String(evt.data.sourceTxHash),
                );
                return machines;
            },
        }),

        depositMachineSpawner: assign({
            depositMachines: (context, _) => {
                const machines: typeof context.depositMachines = {};
                for (const tx of Object.entries(
                    context.tx.transactions || {},
                )) {
                    const machineContext = {
                        deposit: tx[1],
                    };

                    machines[tx[0]] = spawnDepositMachine(
                        machineContext,
                        machineContext.deposit.sourceTxHash,
                    );
                }
                return { ...machines, ...context.depositMachines };
            },
        }),
        listenerAction: listenerAction as any,
    },

    guards: {
        isRequestCompleted: ({ mintRequests }, evt) =>
            (mintRequests || []).includes(evt.data?.sourceTxHash) &&
            evt.data.destTxHash,
        isCompleted: ({ tx }, evt) =>
            evt.data?.sourceTxAmount >= tx.targetAmount,
        isExpired: ({ tx }) => tx.expiryTime < new Date().getTime(),
        isCreated: ({ tx }) => (tx.gatewayAddress ? true : false),
    },
};
