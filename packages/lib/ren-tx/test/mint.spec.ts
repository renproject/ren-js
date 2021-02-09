/* eslint-disable no-console */

import { TxStatus } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { AbstractRenVMProvider } from "@renproject/rpc";
import { RenVMProvider } from "@renproject/rpc/build/main/v1";
import { interpret } from "xstate";
import { config as loadDotEnv } from "dotenv";

import {
    GatewaySession,
    GatewayTransaction,
    mintConfig,
    mintMachine,
} from "../src";
import {
    buildMockLockChain,
    buildMockMintChain,
    MockLockChainParams,
} from "./testutils/mock";
import { SECONDS } from "@renproject/utils";

loadDotEnv();
const providers = {
    testDestChain: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
};

const makeMintTransaction = (): GatewaySession => ({
    id: "a unique identifier",
    type: "mint",
    network: "testnet",
    sourceAsset: "btc",
    sourceChain: "testSourceChain",
    destAddress: "0x0000000000000000000000000000000000000000",
    destChain: "testDestChain",
    targetAmount: 1,
    userAddress: "0x0000000000000000000000000000000000000000",
    expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
    transactions: {},
    customParams: {},
});

const buildConfirmingMachine = (
    config: MockLockChainParams = {},
    sdk = new RenJS("testnet", { networkDelay: 1 * SECONDS }),
) => {
    const { mockLockChain, setConfirmations } = buildMockLockChain(config);

    const fromChainMap = {
        testSourceChain: () => {
            return mockLockChain;
        },
    };

    const toChainMap = {
        testDestChain: () => {
            return buildMockMintChain().mockMintChain;
        },
    };
    const machine = mintMachine.withConfig(mintConfig).withContext({
        tx: makeMintTransaction(),
        sdk,
        providers,
        fromChainMap,
        toChainMap,
    });

    let confirmations = 0;
    setInterval(() => {
        setConfirmations((confirmations += 1));
    }, 1000);
    return { machine, setConfirmations };
};

jest.setTimeout(1000 * 500);
describe("MintMachine", () => {
    it("should create a tx", async () => {
        const { machine } = buildConfirmingMachine();

        const p: Promise<string> = new Promise((resolve, reject) => {
            const service = interpret(machine)
                .onTransition((state) => {
                    if (state.context.tx.error) {
                        reject(state.context.tx.error);
                    }
                    if (state?.context?.tx?.gatewayAddress) {
                        // we have successfully detected a deposit and spawned
                        // a machine to listen for updates
                        resolve(state.context.tx.gatewayAddress);
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            service.onStop(() => console.log("Service stopped"));
        });
        return p.then((gatewayAddress: string) => {
            expect(gatewayAddress).toBeTruthy();
        });
    });

    it("should detect confirmations", async () => {
        const { machine } = buildConfirmingMachine();

        let prevDepositTx: GatewayTransaction;
        const p = new Promise((resolve, reject) => {
            const service = interpret(machine)
                .onTransition((state) => {
                    if (state.context.tx.error) {
                        reject(state.context.tx.error);
                    }
                    const depositTx = Object.values(
                        state.context.tx.transactions,
                    )[0];

                    if (depositTx) {
                        if (
                            (prevDepositTx?.sourceTxConfs || 0) <
                            depositTx.sourceTxConfs
                        ) {
                            resolve(true);
                        }
                        prevDepositTx = depositTx;
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            service.onStop(() => console.log("Service stopped"));
        });

        return p.then(() => {
            const depositTx = Object.values(
                machine.context?.tx?.transactions || {},
            )[0];
            expect(depositTx.sourceTxConfs).toBeGreaterThan(0);
        });
    });

    it("should detect confirmations for multiple deposits", async () => {
        const { machine } = buildConfirmingMachine({
            deposits: [
                {
                    transaction: {
                        amount: "2",
                        txHash:
                            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6298",
                    },
                    amount: "2",
                },
                {
                    transaction: {
                        amount: "1",
                        txHash:
                            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                    },
                    amount: "1",
                },
            ],
        });

        let prevDepositTxs: { [key: string]: GatewayTransaction } = {};
        const p = new Promise((resolve, reject) => {
            const service = interpret(machine)
                .onTransition((state) => {
                    if (state.context.tx.error) {
                        reject(state.context.tx.error);
                    }
                    let resolved =
                        Object.values(state.context.tx.transactions).length > 0;
                    for (let depositTx of Object.values(
                        state.context.tx.transactions,
                    )) {
                        if (
                            resolved &&
                            (prevDepositTxs[depositTx.sourceTxHash]
                                ?.sourceTxConfs || 0) < depositTx.sourceTxConfs
                        ) {
                        } else {
                            resolved = false;
                        }
                        prevDepositTxs[depositTx.sourceTxHash] = depositTx;
                    }

                    if (resolved) {
                        resolve(true);
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            service.onStop(() => console.log("Service stopped"));
        });

        return p.then(() => {
            for (let depositTx of Object.values(
                machine.context?.tx?.transactions || {},
            )) {
                expect(depositTx.sourceTxConfs).toBeGreaterThan(0);
            }
        });
    });

    it("should try to submit once the confirmation target has been met", async () => {
        const renVMProvider: AbstractRenVMProvider = new RenVMProvider(
            "testnet",
        );
        let txHash: string;
        let confirmed = false;

        // mock the minting process
        renVMProvider.submitMint = async (..._args) =>
            new Promise((resolve, reject) => {
                setTimeout(() => {
                    // Only resolve if the tx is actually confirmed
                    if (txHash && confirmed) resolve(Buffer.from(txHash));

                    reject(Error("notx"));
                }, 200);
            });

        // mock waiting for the transaction
        renVMProvider.waitForTX = (_selector, _utxoTxHash, onStatus) => {
            if (txHash && confirmed && onStatus)
                onStatus(TxStatus.TxStatusDone);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { out: { signature: Buffer.from("signature") } } as any;
        };

        const { machine, setConfirmations } = buildConfirmingMachine(
            {
                targetConfirmations: 2,
            },
            new RenJS(renVMProvider, { networkDelay: 1 * SECONDS }),
        );

        let confirmations = 0;

        // We should have at least 2 confirmations by the time the second confirmation event fires
        setInterval(() => {
            setConfirmations((confirmations += 1));
        }, 10000);

        const p = new Promise((resolve, reject) => {
            let subscribed = false;
            const service = interpret(machine)
                .onTransition((state) => {
                    if (state.context.tx.error) {
                        reject(state.context.tx.error);
                    }
                    const depositMachine = Object.values(
                        state.context?.depositMachines || {},
                    )[0];
                    if (depositMachine && !subscribed) {
                        subscribed = true;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        depositMachine.subscribe((innerState: any) => {
                            if (!txHash) {
                                txHash =
                                    innerState.context.deposit.sourceTxHash;
                            }

                            if (innerState?.event?.type === "CONFIRMED") {
                                confirmed = true;
                            }

                            if (innerState?.event?.type === "SIGNED") {
                                depositMachine.send({ type: "CLAIM" });
                            }

                            if (innerState?.value === "destInitiated") {
                                resolve(true);
                                // depositMachine.send({ type: "CLAIM" });
                            }
                        });
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            service.onStop(() => console.log("Service stopped"));
        });
        return p.then(() => {
            const depositTx = Object.values(
                machine.context?.tx?.transactions || {},
            )[0];
            expect(depositTx.sourceTxConfs).toBeGreaterThan(0);
        });
    });

    it("should restore an already existing deposit", async () => {
        const { mockLockChain, setConfirmations } = buildMockLockChain({
            targetConfirmations: 2,
        });

        const fromChainMap = {
            testSourceChain: () => {
                return mockLockChain;
            },
        };

        const toChainMap = {
            testDestChain: () => {
                return buildMockMintChain().mockMintChain;
            },
        };

        const renVMProvider: AbstractRenVMProvider = new RenVMProvider(
            "testnet",
        );
        let txHash: string;
        let confirmed = false;
        renVMProvider.submitMint = async (..._args) =>
            new Promise((resolve, reject) => {
                const backoff = () =>
                    setTimeout(() => {
                        // Only resolve if the tx is actually confirmed
                        if (txHash && confirmed)
                            return resolve(Buffer.from(txHash));
                        reject();
                        // backoff();
                    }, 200);
                backoff();
            });

        renVMProvider.waitForTX = (_selector, _utxoTxHash, onStatus) => {
            if (txHash && confirmed && onStatus)
                onStatus(TxStatus.TxStatusDone);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { out: { signature: Buffer.from("signature") } } as any;
        };

        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: {
                ...makeMintTransaction(),
                nonce:
                    "82097a6ec9591b770b8a2db129e067602e842c3d3a088cfc67770e7e2312af93",
                gatewayAddress: "gatewayAddress",
                transactions: {
                    ["0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299"]: {
                        sourceTxAmount: 1,
                        sourceTxConfs: 0,
                        detectedAt: 0,
                        sourceTxHash:
                            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                        rawSourceTx: {
                            amount: "1",
                            transaction: {
                                txHash:
                                    "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                            },
                        },
                    },
                },
            },
            sdk: new RenJS(renVMProvider, {
                networkDelay: 1 * SECONDS,
                logLevel: "debug",
            }),
            providers,
            fromChainMap,
            toChainMap,
        });

        let confirmations = 0;
        setInterval(() => {
            setConfirmations((confirmations += 1));
        }, 5000);

        const p = new Promise((resolve, reject) => {
            let subscribed = false;
            const service = interpret(machine)
                .onTransition((state) => {
                    if (state.context.tx.error) {
                        reject(state.context.tx.error);
                    }
                    const depositMachine = Object.values(
                        state.context?.depositMachines || {},
                    )[0];
                    if (depositMachine && !subscribed) {
                        subscribed = true;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        depositMachine.subscribe((innerState: any) => {
                            if (!txHash)
                                txHash =
                                    innerState.context.deposit.sourceTxHash;
                            if (innerState?.event?.type === "CONFIRMED") {
                                confirmed = true;
                            }

                            if (innerState?.value === "accepted") {
                                depositMachine.send({ type: "CLAIM" });
                            }

                            if (innerState?.value === "destInitiated") {
                                resolve(true);
                            }
                        });
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            // service.subscribe(((state: any, evt: any) => {}) as any);
            service.onStop(() => console.log("Service stopped"));
        });

        return p.then(() => {
            const depositTx = Object.values(
                machine.context?.tx?.transactions || {},
            )[0];
            expect(depositTx.sourceTxConfs).toBeGreaterThan(0);
        });
    });

    it("should restore multiple existing deposits", async () => {
        const { mockLockChain, setConfirmations } = buildMockLockChain({
            targetConfirmations: 2,
        });

        const fromChainMap = {
            testSourceChain: () => {
                return mockLockChain;
            },
        };

        const toChainMap = {
            testDestChain: () => {
                return buildMockMintChain().mockMintChain;
            },
        };

        const renVMProvider: AbstractRenVMProvider = new RenVMProvider(
            "testnet",
        );
        let txHash: string;
        let confirmed: { [key: string]: boolean } = {};
        renVMProvider.submitMint = async (..._args) =>
            new Promise((resolve, reject) => {
                const backoff = () =>
                    setTimeout(() => {
                        // Only resolve if the all txes are confirmed
                        if (
                            txHash &&
                            Object.values(confirmed).filter((x) => x === false)
                                .length == 0
                        )
                            return resolve(Buffer.from(txHash));
                        reject();
                        // backoff();
                    }, 200);
                backoff();
            });

        renVMProvider.waitForTX = (_selector, _utxoTxHash, onStatus) => {
            const allConfirmed =
                Object.values(confirmed).filter((x) => x === false).length == 0;
            if (txHash && allConfirmed && onStatus)
                onStatus(TxStatus.TxStatusDone);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { out: { signature: Buffer.from("signature") } } as any;
        };

        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: {
                ...makeMintTransaction(),
                nonce:
                    "82097a6ec9591b770b8a2db129e067602e842c3d3a088cfc67770e7e2312af93",
                gatewayAddress: "gatewayAddress",
                transactions: {
                    ["0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6298"]: {
                        sourceTxAmount: 2,
                        sourceTxConfs: 0,
                        detectedAt: 0,
                        sourceTxHash:
                            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6298",
                        rawSourceTx: {
                            amount: "2",
                            transaction: {
                                txHash:
                                    "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6298",
                            },
                        },
                    },
                    ["0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299"]: {
                        sourceTxAmount: 1,
                        sourceTxConfs: 0,
                        detectedAt: 0,
                        sourceTxHash:
                            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                        rawSourceTx: {
                            amount: "1",
                            transaction: {
                                txHash:
                                    "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                            },
                        },
                    },
                },
            },
            sdk: new RenJS(renVMProvider, { networkDelay: 1 * SECONDS }),
            providers,
            fromChainMap,
            toChainMap,
        });

        let confirmations = 0;
        setInterval(() => {
            setConfirmations((confirmations += 1));
        }, 5000);

        const p = new Promise((resolve, reject) => {
            let subscribed: { [key: string]: boolean } = {};
            const service = interpret(machine)
                .onTransition((state) => {
                    if (state.context.tx.error) {
                        reject(state.context.tx.error);
                    }
                    for (let depositMachine of Object.values(
                        state.context?.depositMachines || {},
                    )) {
                        if (depositMachine && !subscribed[depositMachine.id]) {
                            subscribed[depositMachine.id] = true;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            depositMachine.subscribe((innerState: any) => {
                                if (!txHash)
                                    txHash =
                                        innerState.context.deposit.sourceTxHash;
                                if (innerState?.event?.type === "CONFIRMED") {
                                    confirmed[depositMachine.id] = true;
                                }

                                if (innerState?.value === "accepted") {
                                    depositMachine.send({ type: "CLAIM" });
                                }

                                if (innerState?.value === "destInitiated") {
                                    resolve(true);
                                }
                            });
                        }
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            // service.subscribe(((state: any, evt: any) => {}) as any);
            service.onStop(() => console.log("Service stopped"));
        });

        return p.then(() => {
            for (let depositTxPair of Object.entries(
                machine.context?.tx?.transactions || {},
            )) {
                expect(depositTxPair[1].sourceTxConfs).toBeGreaterThan(0);
                expect(depositTxPair[1].sourceTxHash).toEqual(depositTxPair[0]);
            }
        });
    });

    it("should list deposits that requires interaction", async () => {
        const { mockLockChain, setConfirmations } = buildMockLockChain({
            targetConfirmations: 2,
        });

        const fromChainMap = {
            testSourceChain: () => {
                return mockLockChain;
            },
        };

        const toChainMap = {
            testDestChain: () => {
                return buildMockMintChain().mockMintChain;
            },
        };

        const renVMProvider: AbstractRenVMProvider = new RenVMProvider(
            "testnet",
        );
        let txHash: string;
        let confirmed = false;
        renVMProvider.submitMint = async (..._args) =>
            new Promise((resolve, reject) => {
                setTimeout(() => {
                    // Only resolve if the tx is actually confirmed
                    if (txHash && confirmed) resolve(Buffer.from(txHash));

                    reject(Error("notx"));
                }, 200);
            });

        renVMProvider.waitForTX = (_selector, _utxoTxHash, onStatus) => {
            if (txHash && confirmed && onStatus)
                onStatus(TxStatus.TxStatusDone);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { out: { signature: Buffer.from("signature") } } as any;
        };

        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: {
                ...makeMintTransaction(),
                nonce:
                    "82097a6ec9591b770b8a2db129e067602e842c3d3a088cfc67770e7e2312af93",
                gatewayAddress: "gatewayAddress",
                transactions: {
                    ["0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299"]: {
                        sourceTxAmount: 1,
                        sourceTxConfs: 1,
                        detectedAt: 0,
                        sourceTxHash:
                            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                        rawSourceTx: {
                            amount: "1",
                            transaction: {
                                txHash:
                                    "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                            },
                        },
                    },
                },
            },
            sdk: new RenJS(renVMProvider, { networkDelay: 1 * SECONDS }), // , { logLevel: "debug" }),
            providers,
            fromChainMap,
            toChainMap,
        });

        let confirmations = 0;
        setInterval(() => {
            setConfirmations((confirmations += 1));
        }, 10000);

        const p = new Promise((resolve, reject) => {
            let subscribed = false;
            let signed = false;
            const service = interpret(machine)
                .onTransition((state) => {
                    if (state.context.tx.error) {
                        reject(state.context.tx.error);
                    }
                    const depositMachine = Object.values(
                        state.context?.depositMachines || {},
                    )[0];
                    if (confirmed && !signed) {
                        const requests = state.context?.mintRequests;
                        if (requests && requests[0]) {
                            const tx =
                                state.context?.tx.transactions[requests[0]];
                            service.send({
                                type: "CLAIM",
                                hash: requests[0],
                                data: tx,
                            } as any);
                            signed = true;
                        }
                    }
                    if (depositMachine && !subscribed) {
                        subscribed = true;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        depositMachine.subscribe((innerState: any) => {
                            if (!txHash)
                                txHash =
                                    innerState.context.deposit.sourceTxHash;
                            if (
                                innerState?.event?.type === "CONFIRMED" ||
                                innerState.value === "srcConfirmed"
                            ) {
                                confirmed = true;
                            }
                            if (innerState?.value === "destInitiated") {
                                resolve(true);
                            }
                        });
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            // service.subscribe(((state: any, evt: any) => {}) as any);
            service.onStop(() => console.log("Service stopped"));
        });

        return p.then(() => {
            const depositTx = Object.values(
                machine.context?.tx?.transactions || {},
            )[0];
            expect(depositTx.sourceTxConfs).toBeGreaterThan(0);
        });
    });
});
