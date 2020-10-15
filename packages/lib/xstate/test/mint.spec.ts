import { interpret } from "xstate";
const utils = jest.genMockFromModule("@renproject/utils") as any;

utils.SECONDS = 100;

import RenJS from "@renproject/ren";

import {
    mintMachine,
    mintConfig,
    GatewaySession,
    GatewayTransaction,
} from "../src";
import { LockChain, MintChain, TxStatus } from "@renproject/interfaces";
import { RenVMProvider } from "@renproject/rpc/build/main/v1";
import { AbstractRenVMProvider } from "@renproject/rpc";

require("dotenv").config();
const providers = {
    testDestChain: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
};

const confirmationRegistry: number[] = [];
const getConfs = (id: number) => {
    return confirmationRegistry[id];
};

function buildMockLockChain(conf = { targetConfirmations: 500 }) {
    const id = confirmationRegistry.length;
    confirmationRegistry[id] = 0;
    const transactionConfidence = () => {
        return {
            current: getConfs(id),
            target: conf.targetConfirmations,
        };
    };

    const mockLockChain: LockChain = {
        name: "mockLockChain",
        assetDecimals: () => 1,
        addressIsValid: () => true,
        transactionID: () => "tid",
        transactionConfidence,
        initialize: () => {
            return mockLockChain;
        },
        supportsAsset: () => true,
        getDeposits: () => [{ transaction: {}, amount: "1" }],
        generateNHash: () => Buffer.from("123"),
        getGatewayAddress: () => "gatewayaddr",
        getPubKeyScript: () => Buffer.from("pubkey"),
        depositV1HashString: () => "v1hashstring",
        depositRPCFormat: () => {},
    };
    return {
        mockLockChain,
        setConfirmations: (n: number) => {
            confirmationRegistry[id] = n;
        },
    };
}

function buildMockMintChain() {
    const state = {
        currentLockConfs: 0,
    };
    const mockMintChain: MintChain = {
        name: "mockMintChain",
        assetDecimals: () => 1,
        addressIsValid: () => true,
        transactionID: () => "tid" + new Date().getTime(),
        transactionConfidence: () => ({ current: 0, target: 1 }),
        initialize: () => {
            return mockMintChain;
        },
        supportsAsset: () => true,
        resolveTokenGatewayContract: async () =>
            "0x0000000000000000000000000000000000000000",
        submitMint: (_asset, _calls, _tx, emitter) => {
            setTimeout(() => {
                emitter.emit(
                    "transactionHash",
                    "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299"
                );
            }, 100);
        },
        findBurnTransaction: () => "burnTxHash",
        findTransaction: () => "mintTxHash",
        contractCalls: async () => [
            {
                sendTo: "0x0000000000000000000000000000000000000000",
                contractFn: "nop",
            },
        ],
    };
    return { mockMintChain, state };
}

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
describe("MintMachine", function () {
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
                Object.keys(machine?.context?.tx?.transactions || {}).length
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
        setInterval(() => setConfirmations((confirmations += 1)), 100);
        let prevDepositTx: GatewayTransaction;
        const p = new Promise((resolve) => {
            const service = interpret(machine)
                .onTransition((state) => {
                    const depositTx = Object.values(
                        state.context.tx.transactions
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
                machine.context?.tx?.transactions || {}
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
            "testnet"
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
        setInterval(() => setConfirmations((confirmations += 1)), 100);
        const p = new Promise((resolve) => {
            let subscribed = false;
            const service = interpret(machine)
                .onTransition((state) => {
                    const depositMachine = Object.values(
                        state.context?.depositMachines || {}
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
                machine.context?.tx?.transactions || {}
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
            "testnet"
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
                    ["vKFLy1mcP/RrjtuujIklZF1eRjuVPALtY85KO0Tk+1M="]: {
                        sourceTxAmount: 1,
                        sourceTxConfs: 1,
                        sourceTxHash:
                            "vKFLy1mcP/RrjtuujIklZF1eRjuVPALtY85KO0Tk+1M=",
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
        setInterval(() => setConfirmations((confirmations += 1)), 100);
        const p = new Promise((resolve) => {
            let subscribed = false;
            const service = interpret(machine)
                .onTransition((state) => {
                    const depositMachine = Object.values(
                        state.context?.depositMachines || {}
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
                machine.context?.tx?.transactions || {}
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
            "testnet"
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
                    ["vKFLy1mcP/RrjtuujIklZF1eRjuVPALtY85KO0Tk+1M="]: {
                        sourceTxAmount: 1,
                        sourceTxConfs: 1,
                        sourceTxHash:
                            "vKFLy1mcP/RrjtuujIklZF1eRjuVPALtY85KO0Tk+1M=",
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
        setInterval(() => setConfirmations((confirmations += 1)), 100);
        const p = new Promise((resolve) => {
            let subscribed = false;
            const service = interpret(machine)
                .onTransition((state) => {
                    const depositMachine = Object.values(
                        state.context?.depositMachines || {}
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
                machine.context?.tx?.transactions || {}
            )[0];
            expect(depositTx.sourceTxConfs).toBeGreaterThan(0);
        });
    });
});
