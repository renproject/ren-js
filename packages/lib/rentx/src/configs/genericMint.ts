import RenJS from "@renproject/ren";
import { Actor, assign, MachineOptions, Receiver, Sender, spawn } from "xstate";
import { depositMachine, DepositMachineContext } from "../machines/deposit";
import { GatewayMachineContext } from "../machines/mint";
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

export const renLockAndMint = async (context: GatewayMachineContext) => {
    const {
        nonce,
        destNetwork,
        suggestedAmount,
        sourceNetwork,
        sourceAsset,
    } = context.tx;
    const { sdk, fromChainMap, toChainMap } = context;

    const mint = await sdk.lockAndMint({
        asset: sourceAsset.toUpperCase(),
        suggestedAmount,
        from: fromChainMap[sourceNetwork](context),
        to: toChainMap[destNetwork](context),
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

    const { targetAmount, sourceAsset } = context.tx;

    try {
        const fees = await context.sdk.getFees();
        context.tx.suggestedAmount = Math.floor(
            fees[sourceAsset.toLowerCase()].lock +
                (Number(targetAmount) || 0.0001) * 1e8,
        );
    } catch (error) {
        console.error(error);
        context.tx.suggestedAmount = 0.0008 * 1e8;
    }
    const minter = await renLockAndMint(context);
    const gatewayAddress = minter?.gatewayAddress;
    const newTx: GatewaySession = {
        ...context.tx,
        gatewayAddress,
        // Not serializable
        // params: deposit.params,
    };
    return newTx;
};

// Listen for confirmations on the source chain
const depositListener = (
    context: GatewayMachineContext | DepositMachineContext,
) => (callback: Sender<any>, receive: Receiver<any>) => {
    let cleanup = () => {};
    renLockAndMint(context).then(async (minter) => {
        cleanup = () => minter.removeAllListeners();
        minter.on("deposit", async (deposit) => {
            // Register event handlers prior to setup in case events land early
            receive((event) => {
                switch (event.type) {
                    case "SETTLE":
                        deposit
                            .confirmed()
                            .on("target", (confs, targetConfs) => {
                                const confirmedTx = {
                                    sourceTxConfs: confs,
                                    sourceTxConfTarget: targetConfs,
                                };
                                // Theoretically, this isn't a confirmation
                                // but they are functionally identical, so
                                // lets re-use the event
                                callback({
                                    type: "CONFIRMATION",
                                    data: confirmedTx,
                                });
                            })
                            .on("confirmation", (confs, targetConfs) => {
                                const confirmedTx = {
                                    sourceTxConfs: confs,
                                    sourceTxConfTarget: targetConfs,
                                };
                                callback({
                                    type: "CONFIRMATION",
                                    data: confirmedTx,
                                });
                            })
                            .then(() => {
                                callback({
                                    type: "CONFIRMED",
                                });
                            });
                        break;
                    case "SIGN":
                        deposit
                            ?.signed()
                            .on("status", (state) => console.log(state))
                            .then((v) =>
                                callback({
                                    type: "SIGNED",
                                    data: {
                                        renResponse: v._queryTxResult,
                                        signature:
                                            v._queryTxResult?.out?.signature,
                                    },
                                }),
                            )
                            .catch((e) =>
                                callback({ type: "SIGN_ERROR", data: e }),
                            );
                        break;
                    case "MINT":
                        deposit
                            ?.mint(event.data)
                            .on("confirmation", (_confirmations) => {
                                // We can check dest confirmations here
                                // (for eth at least)
                            })
                            .on("transactionHash", (txHash) => {
                                const submittedTx = {
                                    destTxHash: txHash,
                                };
                                callback({
                                    type: "SUBMITTED",
                                    data: submittedTx,
                                });
                            })
                            .catch((e) =>
                                callback({ type: "SUBMIT_ERROR", data: e }),
                            );
                        break;
                }
            });

            const txHash = await deposit.txHash();

            // Prevent deposit machine tx listeners from interacting with other deposits
            const targetDeposit = (context as DepositMachineContext).deposit;
            if (targetDeposit) {
                if (targetDeposit.sourceTxHash !== txHash) {
                    console.error(
                        "wrong deposit:",
                        targetDeposit.sourceTxHash,
                        txHash,
                    );
                    // FIXME: In theory, we might process an event before there is a cleanup
                    // but it is more likely to receive a valid event immediately
                    // after the listener is initialized
                    return () => {
                        cleanup();
                    };
                }
            }

            const persistedTx = context.tx.transactions[txHash];
            // If we don't have a sourceTxHash, we haven't seen a deposit yet
            const rawSourceTx: any = deposit.depositDetails.transaction;
            const depositState: GatewayTransaction = persistedTx
                ? persistedTx
                : {
                      sourceTxHash: txHash,
                      sourceTxConfs: 0,
                      sourceTxAmount: rawSourceTx.amount,
                      rawSourceTx,
                  };

            if (!persistedTx) {
                callback({
                    type: "DEPOSIT",
                    data: { ...depositState },
                });
            } else {
                callback("DETECTED");
            }
        });

        receive((event) => {
            switch (event.type) {
                case "RESTORE":
                    try {
                        minter.processDeposit({
                            transaction: event.data,
                            amount: event.data.amount,
                        });
                    } catch (e) {
                        console.error(e);
                    }
                    break;
            }
        });

        callback("LISTENING");
    });
    return () => {
        cleanup();
    };
};

// Spawn an actor that will listen for either all deposits to a gatewayAddress,
// or to a single deposit if present in the context
const listenerAction = assign<GatewayMachineContext>({
    depositListenerRef: (
        c: GatewayMachineContext | DepositMachineContext,
        _e: any,
    ) => {
        let actorName = `${c.tx.id}SessionListener`;
        const deposit = (c as DepositMachineContext).deposit;
        if (deposit) {
            actorName = `${deposit.sourceTxHash}DepositListener`;
        }
        if (c.depositListenerRef && !deposit) {
            console.warn("listener already exists");
            return c.depositListenerRef;
        }
        const cb = depositListener(c);
        return spawn(cb, actorName);
    },
});

const spawnDepositMachine = (
    machineContext: DepositMachineContext,
    name: string,
) =>
    spawn(
        depositMachine
            .withContext(machineContext as DepositMachineContext)
            .withConfig({
                actions: {
                    listenerAction: listenerAction as any,
                },
            }),
        {
            sync: true,
            name,
        },
    ) as Actor<any>;

export const mintConfig: Partial<MachineOptions<GatewayMachineContext, any>> = {
    services: {
        txCreator,
        depositListener,
    },
    actions: {
        spawnDepositMachine: assign({
            depositMachines: (context, evt) => {
                const machines = context.depositMachines || {};
                if (machines[evt.data?.sourceTxHash] || !evt.data) {
                    return machines;
                }
                const machineContext = {
                    ...context,
                    deposit: evt.data,
                };

                // We don't want child machines to have references to siblings
                delete (machineContext as any).depositMachines;
                machines[evt.data.sourceTxHash] = spawnDepositMachine(
                    machineContext,
                    `${evt.data.sourceTxHash}DepositMachine`,
                );
                return machines;
            },
        }),
        depositMachineSpawner: assign({
            depositMachines: (context, _) => {
                const machines = context.depositMachines || {};
                for (let i of Object.entries(context.tx.transactions || {})) {
                    const machineContext = {
                        ...context,
                        deposit: i[1],
                    };
                    // We don't want child machines to have references to siblings
                    delete (machineContext as any).depositMachines;
                    machines[i[0]] = spawnDepositMachine(
                        machineContext,
                        `${machineContext.deposit.sourceTxHash}DepositMachine`,
                    );
                }
                return machines;
            },
        }),
        listenerAction: listenerAction as any,
    },
    guards: {
        isCompleted: ({ tx }, evt) =>
            evt.data?.sourceTxAmount >= tx.targetAmount,
        isExpired: ({ tx }) => tx.expiryTime < new Date().getTime(),
        isCreated: ({ tx }) => (tx.gatewayAddress ? true : false),
    },
};
