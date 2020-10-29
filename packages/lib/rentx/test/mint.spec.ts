// tslint:disable: no-console

import { TxStatus } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { AbstractRenVMProvider } from "@renproject/rpc";
import { RenVMProvider } from "@renproject/rpc/build/main/v1";
import { interpret } from "xstate";

import {
    GatewaySession,
    GatewayTransaction,
    mintConfig,
    mintMachine,
} from "../src";
import { buildMockLockChain, buildMockMintChain } from "./testutils/mock";

require("dotenv").config();
const providers = {
    testDestChain: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
};

const makeMintTransaction = (): GatewaySession => ({
    id: "a unique identifier",
    type: "mint",
    network: "testnet",
    sourceAsset: "btc",
    sourceNetwork: "testSourceChain",
    destAddress: "0x0000000000000000000000000000000000000000",
    destAsset: "renBTC",
    destNetwork: "testDestChain",
    destConfsTarget: 6,
    targetAmount: 1,
    userAddress: "0x0000000000000000000000000000000000000000",
    expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
    transactions: {},
});

jest.setTimeout(1000 * 106);
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

        const p = new Promise((resolve) => {
            const service = interpret(machine)
                .onTransition((state) => {
                    if (
                        Object.values(state?.context?.depositMachines || {})[0]
                    ) {
                        // we have successfully detected a depost and spawned
                        // a machine to listen for updates
                        resolve();
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            service.subscribe(((state: any, evt: any) => {}) as any);
            service.onStop(() => console.log("Service stopped"));
        });
        return p.then(() => {
            expect(
                Object.keys(machine?.context?.tx?.transactions || {}).length,
            ).toBeGreaterThan(0);
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
        const p = new Promise((resolve) => {
            const service = interpret(machine)
                .onTransition((state) => {
                    const depositTx = Object.values(
                        state.context.tx.transactions,
                    )[0];

                    if (depositTx) {
                        if (
                            (prevDepositTx?.sourceTxConfs || 0) <
                            depositTx.sourceTxConfs
                        ) {
                            resolve();
                        }
                        prevDepositTx = depositTx;
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            service.subscribe(((state: any, evt: any) => {}) as any);
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
            targetConfirmations: 10,
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

        const renVMProvider = (new RenVMProvider(
            "testnet",
        ) as any) as AbstractRenVMProvider;
        let txHash: string;
        let confirmed = false;
        renVMProvider.submitMint = async (...args) => {
            if (txHash && confirmed) return Buffer.from(txHash);
            throw Error("notx");
        };
        renVMProvider.waitForTX = async (_a, cb) => {
            if (txHash && confirmed && cb) cb(TxStatus.TxStatusDone);
            return { out: { signature: Buffer.from("signature") } } as any;
        };

        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: makeMintTransaction(),
            sdk: new RenJS(renVMProvider), //, { logLevel: "debug" }),
            providers,
            fromChainMap,
            toChainMap,
        });

        let confirmations = 0;
        setInterval(() => {
            setConfirmations((confirmations += 1));
        }, 100);
        // tslint:disable-next-line: promise-must-complete
        const p = new Promise((resolve) => {
            let subscribed = false;
            const service = interpret(machine)
                .onTransition((state) => {
                    const depositMachine = Object.values(
                        state.context?.depositMachines || {},
                    )[0];
                    if (depositMachine && !subscribed) {
                        subscribed = true;
                        depositMachine.subscribe((state: any) => {
                            if (!txHash)
                                txHash = state.context.deposit.sourceTxHash;
                            if (state?.event?.type === "CONFIRMED") {
                                confirmed = true;
                            }

                            if (state?.event?.type === "SIGNED") {
                                depositMachine.send({ type: "CLAIM" });
                            }

                            if (state?.value === "destInitiated") {
                                resolve();
                                // depositMachine.send({ type: "CLAIM" });
                            }
                        });
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            // service.subscribe(((state: any, evt: any) => {}) as any);
            // Object.values(machine.context.depositMachines)[0].subscribe
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
            targetConfirmations: 10,
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

        const renVMProvider = (new RenVMProvider(
            "testnet",
        ) as any) as AbstractRenVMProvider;
        let txHash: string;
        let confirmed = false;
        renVMProvider.submitMint = async (...args) => {
            if (txHash && confirmed) return Buffer.from(txHash);
            throw Error("notx");
        };
        renVMProvider.waitForTX = async (_a, cb) => {
            if (txHash && confirmed && cb) cb(TxStatus.TxStatusDone);
            return { out: { signature: Buffer.from("signature") } } as any;
        };

        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: {
                ...makeMintTransaction(),
                nonce:
                    "82097a6ec9591b770b8a2db129e067602e842c3d3a088cfc67770e7e2312af93",
                gatewayAddress: "gatewayaddr",
                transactions: {
                    ["wDRsvC2ihOVE6HntEuecoDC3/PydP9N7X9mFdR9Ofeo="]: {
                        sourceTxAmount: 1,
                        sourceTxConfs: 1,
                        sourceTxHash:
                            "wDRsvC2ihOVE6HntEuecoDC3/PydP9N7X9mFdR9Ofeo=",
                        rawSourceTx: {},
                    },
                },
            },
            sdk: new RenJS(renVMProvider), //, { logLevel: "debug" }),
            providers,
            fromChainMap,
            toChainMap,
        });

        let confirmations = 0;
        setInterval(() => {
            setConfirmations((confirmations += 1));
        }, 100);
        // tslint:disable-next-line: promise-must-complete
        const p = new Promise((resolve) => {
            let subscribed = false;
            const service = interpret(machine)
                .onTransition((state) => {
                    const depositMachine = Object.values(
                        state.context?.depositMachines || {},
                    )[0];
                    if (depositMachine && !subscribed) {
                        subscribed = true;
                        depositMachine.subscribe((state: any) => {
                            if (!txHash)
                                txHash = state.context.deposit.sourceTxHash;
                            if (state?.event?.type === "CONFIRMED") {
                                confirmed = true;
                            }

                            if (state?.value === "accepted") {
                                depositMachine.send({ type: "CLAIM" });
                            }

                            if (state?.value === "destInitiated") {
                                resolve();
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

    it("should enter a waiting state when a deposit requires interaction", async () => {
        const { mockLockChain, setConfirmations } = buildMockLockChain({
            targetConfirmations: 10,
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

        const renVMProvider = (new RenVMProvider(
            "testnet",
        ) as any) as AbstractRenVMProvider;
        let txHash: string;
        let confirmed = false;
        renVMProvider.submitMint = async (...args) => {
            if (txHash && confirmed) return Buffer.from(txHash);
            throw Error("notx");
        };
        renVMProvider.waitForTX = async (_a, cb) => {
            if (txHash && confirmed && cb) cb(TxStatus.TxStatusDone);
            return { out: { signature: Buffer.from("signature") } } as any;
        };

        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: {
                ...makeMintTransaction(),
                nonce:
                    "82097a6ec9591b770b8a2db129e067602e842c3d3a088cfc67770e7e2312af93",
                gatewayAddress: "gatewayaddr",
                transactions: {
                    ["wDRsvC2ihOVE6HntEuecoDC3/PydP9N7X9mFdR9Ofeo="]: {
                        sourceTxAmount: 1,
                        sourceTxConfs: 1,
                        sourceTxHash:
                            "wDRsvC2ihOVE6HntEuecoDC3/PydP9N7X9mFdR9Ofeo=",
                        rawSourceTx: {},
                    },
                },
            },
            sdk: new RenJS(renVMProvider), //, { logLevel: "debug" }),
            providers,
            fromChainMap,
            toChainMap,
        });

        let confirmations = 0;
        setInterval(() => {
            setConfirmations((confirmations += 1));
        }, 100);
        // tslint:disable-next-line: promise-must-complete
        const p = new Promise((resolve) => {
            let subscribed = false;
            const service = interpret(machine)
                .onTransition((state) => {
                    const depositMachine = Object.values(
                        state.context?.depositMachines || {},
                    )[0];
                    if (confirmed) {
                        if (state.value === "requestingSignature") {
                            service.send("SIGN");
                        }
                    }
                    if (depositMachine && !subscribed) {
                        subscribed = true;
                        depositMachine.subscribe((state: any) => {
                            if (!txHash)
                                txHash = state.context.deposit.sourceTxHash;
                            if (state?.event?.type === "CONFIRMED") {
                                confirmed = true;
                            }
                            if (state?.value === "destInitiated") {
                                resolve();
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
