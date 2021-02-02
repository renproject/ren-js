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
import { buildMockLockChain, buildMockMintChain } from "./testutils/mock";

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

jest.setTimeout(1000 * 200);
describe("MintMachine", () => {
    it("should create a tx", async () => {
        const fromChainMap = {
            testSourceChain: () => {
                return buildMockLockChain().mockLockChain;
            },
        };

        const toChainMap = {
            testDestChain: () => {
                return buildMockMintChain().mockMintChain;
            },
        };

        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: makeMintTransaction(),
            sdk: new RenJS("testnet"),
            providers,
            fromChainMap,
            toChainMap,
        });

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
        const { mockLockChain, setConfirmations } = buildMockLockChain();

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
            sdk: new RenJS("testnet"),
            providers,
            fromChainMap,
            toChainMap,
        });

        let confirmations = 0;
        setInterval(() => {
            setConfirmations((confirmations += 1));
        }, 100);

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

    it("should try to submit once the confirmation target has been met", async () => {
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

        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: makeMintTransaction(),
            sdk: new RenJS(renVMProvider),
            providers,
            fromChainMap,
            toChainMap,
        });

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
            new Promise((resolve, _reject) => {
                const backoff = () =>
                    setTimeout(() => {
                        // Only resolve if the tx is actually confirmed
                        if (txHash && confirmed) resolve(Buffer.from(txHash));
                        backoff();
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
                        sourceTxHash:
                            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                        rawSourceTx: { amount: "1", transaction: {} },
                    },
                },
            },
            sdk: new RenJS(renVMProvider),
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
                        sourceTxHash:
                            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                        rawSourceTx: { amount: "1", transaction: {} },
                    },
                },
            },
            sdk: new RenJS(renVMProvider), // , { logLevel: "debug" }),
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
