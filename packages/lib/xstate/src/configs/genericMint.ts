import {
    BinanceSmartChain,
    Bitcoin,
    BitcoinCash,
    Ethereum,
    Zcash,
} from "@renproject/chains";
import { MintChain } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import {
    LockAndMint,
    LockAndMintDeposit,
} from "@renproject/ren/build/main/lockAndMint";
import Web3 from "web3";
import { Actor, assign, MachineOptions, Receiver, Sender, spawn } from "xstate";
import {
    depositMachine,
    DepositMachineContext,
    DepositMachineEvent,
} from "../machines/deposit";
import { GatewayMachineContext } from "../machines/mint";
import { GatewaySession, GatewayTransaction } from "../types/transaction";

const findClaimableDeposit = ({ depositMachines }: GatewayMachineContext) => {
    if (!depositMachines) return;
    for (let key in depositMachines || {}) {
        const machine = depositMachines[key];
        if (machine.state.value === "accepted") {
            return machine.state.context.deposit;
        }
    }
};

export const mintChainMap: {
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

export const lockChainMap = {
    bitcoin: () => Bitcoin(),
    zcash: () => Zcash(),
    bitcoinCash: () => BitcoinCash(),
};

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
    const nonce = RenJS.utils.randomNonce();
    context.tx.nonce = nonce.toString("hex");

    const { targetAmount, sourceAsset } = context.tx;

    try {
        const fees = await context.sdk.getFees();
        context.tx.suggestedAmount = Math.floor(
            fees[sourceAsset.toLowerCase()].lock +
                (Number(targetAmount) || 0.0001) * 1e8
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
    context: GatewayMachineContext | DepositMachineContext
) => (callback: Sender<any>, receive: Receiver<any>) => {
    let minterRef: LockAndMint | null = null;
    let listener: null | ((deposit: LockAndMintDeposit) => void) = null;
    renLockAndMint(context).then(async (minter) => {
        minterRef = minter;
        listener = async (deposit: LockAndMintDeposit) => {
            const txHash = await deposit.txHash();
            const persistedTx = context.tx.transactions[txHash];
            // Prevent deposit machine tx listeners from interacting with other deposits
            const targetDeposit = (context as DepositMachineContext).deposit;
            if (targetDeposit) {
                if (targetDeposit.sourceTxHash !== txHash) {
                    console.error("wrong deposit");
                    return;
                } else {
                    workingDeposit = deposit;
                }
            }

            // If we don't have a sourceTxHash, we haven't seen a deposit yet
            const rawSourceTx: any = deposit.deposit;
            const depositState: GatewayTransaction = persistedTx || {
                sourceTxHash: txHash,
                sourceTxAmount: rawSourceTx.amount,
                sourceTxVOut: rawSourceTx.vOut,
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
        };

        let workingDeposit: LockAndMintDeposit | null = null;
        minter.on("deposit", listener);

        receive((event) => {
            switch (event.type) {
                case "RESTORE":
                    minter.processTransaction(event.data).then().catch();
                    break;
                case "SETTLE":
                    workingDeposit
                        ?.confirmed()
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
                    workingDeposit
                        ?.signed()
                        .on("status", (state) => console.log(state))
                        .then(() => callback("SIGNED"))
                        .catch((e) =>
                            callback({ type: "SIGN_ERROR", data: e })
                        );
                    break;
                case "MINT":
                    workingDeposit
                        ?.mint()
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
                            callback({ type: "SUBMIT_ERROR", data: e })
                        );
                    break;
            }
        });

        if (context.tx.transactions) {
            minter.wait().then(() => console.log("done waiting"));
        }
        callback("LISTENING");
    });
    return () => {
        if (listener) {
            minterRef?.removeAllListeners();
            // minterRef?.off("deposit", listener);
        }
    };
};

const destConfListener = (context: DepositMachineContext) => (
    callback: Sender<DepositMachineEvent>
) => {
    const web3: Web3 = new Web3(context.providers[context.tx.destNetwork]);
    const interval = setInterval(async () => {
        const destTx = await web3.eth.getTransaction(
            context.deposit.destTxHash || ""
        );
        let update: GatewayTransaction;
        if (!destTx) {
            throw Error("No dest tx");
        }
        if (!destTx.blockNumber) {
            update = { ...context.deposit, destTxConfs: 0 };
            callback({ type: "CONFIRMATION", data: update });
        } else {
            const confs =
                (await web3.eth.getBlockNumber()) - destTx.blockNumber;

            update = { ...context.deposit, destTxConfs: confs };
            callback({ type: "CONFIRMATION", data: update });
        }
    }, 5000);

    return () => clearInterval(interval);
};

const listenerAction = assign<GatewayMachineContext>({
    depositListenerRef: (
        c: GatewayMachineContext | DepositMachineContext,
        _e: any
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

export const mintConfig: Partial<MachineOptions<GatewayMachineContext, any>> = {
    services: {
        txCreator,
        depositListener,
    },
    actions: {
        depositMachineSpawner: assign({
            depositMachines: (context, evt) => {
                const machines = context.depositMachines || {};
                if (evt.type === "DEPOSIT") {
                    if (machines[evt.data.sourceTxHash]) {
                        return machines;
                    }
                    const machineContext = {
                        ...context,
                        deposit: evt.data,
                    };

                    // We don't want child machines to have references to siblings
                    delete (machineContext as any).depositMachines;
                    machines[evt.data.sourceTxHash] = spawn(
                        depositMachine
                            .withContext(
                                machineContext as DepositMachineContext
                            )
                            .withConfig({
                                services: {
                                    destConfListener,
                                },
                                actions: {
                                    listenerAction: listenerAction as any,
                                },
                            }),
                        {
                            sync: true,
                            name: `${evt.data.sourceTxHash}DepositMachine`,
                        }
                    ) as Actor<any>;
                    return machines;
                }
                for (let i of Object.entries(context.tx.transactions)) {
                    const machineContext = {
                        ...context,
                        deposit: i[1],
                    };
                    // We don't want child machines to have references to siblings
                    delete (machineContext as any).depositMachines;
                    machines[i[0]] = spawn(
                        depositMachine.withContext(machineContext).withConfig({
                            services: {
                                destConfListener,
                            },
                            actions: { listenerAction: listenerAction as any },
                        }),
                        {
                            sync: true,
                            name: `${machineContext.deposit.sourceTxHash}DepositMachine`,
                        }
                    ) as Actor<any>;
                }
                return machines;
            },
        }),
        listenerAction: listenerAction as any,
    },
    guards: {
        isRequestingSignature: (ctx) =>
            findClaimableDeposit(ctx) ? true : false,
        isCompleted: ({ tx }, evt) =>
            evt.data.sourceTxAmount >= tx.targetAmount,
        hasExpired: ({ tx }) => tx.expiryTime < new Date().getTime(),
        isCreated: ({ tx }) => (tx.gatewayAddress ? true : false),
    },
};
