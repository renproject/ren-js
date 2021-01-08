import { createModel } from "@xstate/test";
import { mintMachine, mintConfig, depositMachine, burnConfig } from "../src";
import { burnMachine } from "../src/machines/burn";

// const expect = chai.expect;

const makeTestContext = () => ({
    tx: {
        id: "txid",
        type: "mint",
        sourceAsset: "btc",
        sourceChain: "bitcoin",
        network: "testnet",
        destAddress: "",
        destChain: "ethereum",
        destAsset: "renBTC",
        targetAmount: 1,
        userAddress: "",
        expiryTime: new Date().getTime() + 1000 * 60,
        transactions: {
            "123": {
                sourceTxHash: "123",
                sourceTxAmount: 1,
                sourceTxConfs: 0,
                rawSourceTx: {},
            },
        },
    },
    sdk: {} as any,
    providers: {},
    fromChainMap: { btc: () => ({} as any) },
    toChainMap: { ethereum: () => ({} as any) },
});

mintMachine.config = mintConfig as any;
mintMachine.context = makeTestContext() as any;
const mintModel = createModel(mintMachine).withEvents({
    RESTORE: {},
    "done.invoke.txCreator": {
        exec: async () => {},
        cases: [
            { data: { ...makeTestContext().tx, gatewayAddress: "generated" } },
        ],
    },
    "error.platform.txCreator": {
        exec: async () => {},
        cases: [{ data: { message: "an error" } }],
    },
    // Unfortunately these break the test generator due to an issue with context mutation
    // DEPOSIT: { cases: [{ data: { sourceTxHash: "123" } }] },
    DEPOSIT_UPDATE: {
        cases: [{ data: { sourceTxHash: "123", destTxHash: "123" } }],
    },
    EXPIRED: {},
    CLAIMABLE: {},
    ACKNOWLEDGE: {},
});

describe("MintMachine", function () {
    const testPlans = mintModel.getShortestPathPlans();
    testPlans.forEach((plan) => {
        describe(plan.description, () => {
            plan.paths.forEach((path) => {
                it(path.description, async () => {
                    await path.test({});
                });
            });
        });
    });

    it("should have full coverage", () => {
        return mintModel.testCoverage();
    });
});

const depositModel = createModel(
    depositMachine
        .withConfig({
            actions: { listenerAction: mintConfig.actions?.listenerAction },
        } as any)
        .withContext({
            ...makeTestContext(),
            deposit: {
                sourceTxAmount: 0,
                sourceTxHash: "",
                sourceTxConfs: 0,
                rawSourceTx: {},
            },
        } as any),
).withEvents({
    DETECTED: {},
    RESTORE: {},
    ERROR: {
        cases: [{ error: new Error("error") }],
    },
    SIGN_ERROR: {
        cases: [{ data: { message: "an error" } }],
    },
    SUBMIT_ERROR: {
        cases: [{ data: { message: "an error" } }],
    },
    RESTORED: {},
    CONFIRMATION: {},
    CONFIRMED: {},
    REJECT: {},
    SIGNED: {},
    CLAIM: {},
    SUBMITTED: {},
    ACKNOWLEDGE: {},
});

describe("DepositMachine", function () {
    const testPlans = depositModel.getShortestPathPlans();
    testPlans.forEach((plan) => {
        describe(plan.description, () => {
            plan.paths.forEach((path) => {
                it(path.description, async () => {
                    await path.test({});
                });
            });
        });
    });

    it("should have full coverage", () => {
        return depositModel.testCoverage();
    });
});

const burnContext: any = makeTestContext();
burnContext.tx.transactions = {};
const burnModel = createModel(
    burnMachine.withConfig(burnConfig).withContext({
        ...burnContext,
        deposit: {
            sourceTxAmount: 0,
            sourceTxHash: "",
            sourceTxConfs: 0,
            rawSourceTx: {},
        },
    } as any),
).withEvents({
    RESTORE: {},
    "done.invoke.burnCreator": {
        exec: async () => {},
        cases: [{ data: { ...makeTestContext().tx, transactions: {} } }],
    },
    "error.platform.burnCreator": {
        exec: async () => {},
        cases: [{ data: { message: "an error" } }],
    },
    CONFIRMATION: {
        cases: [{ data: { sourceTxHash: "123" } }],
    },
    BURN_ERROR: {
        cases: [{ data: { message: "an error" } }],
    },
    RELEASE_ERROR: {
        cases: [{ data: { message: "an error" } }],
    },
    CONFIRMED: {
        cases: [{ data: { sourceTxHash: "123", sourceTxConfs: 1 } }],
    },
    SUBMITTED: {
        cases: [{ data: { sourceTxHash: "123" } }],
    },
    RELEASED: {},
    RETRY: {},
});

describe("BurnMachine", function () {
    const testPlans = burnModel.getShortestPathPlans();
    testPlans.forEach((plan) => {
        describe(plan.description, () => {
            plan.paths.forEach((path) => {
                it(path.description, async () => {
                    await path.test({});
                });
            });
        });
    });

    it("should have full coverage", () => {
        return burnModel.testCoverage();
    });
});
