import { createModel } from "@xstate/test";
import { mintMachine, mintConfig, depositMachine, burnConfig } from "../src";
import { burnMachine } from "../src/machines/burn";

// const expect = chai.expect;

const testContext = {
    tx: {
        id: "txid",
        type: "mint",
        sourceAsset: "btc",
        sourceNetwork: "bitcoin",
        network: "testnet",
        destAddress: "",
        destNetwork: "ethereum",
        destAsset: "renBTC",
        targetAmount: 1,
        destConfsTarget: 6,
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
};
mintMachine.config = mintConfig as any;
mintMachine.context = testContext as any;
const mintModel = createModel(mintMachine).withEvents({
    RESTORE: {},
    "done.invoke.txCreator": {
        exec: async () => {},
        cases: [{ data: { ...testContext.tx, gatewayAddress: "generated" } }],
    },
    "error.platform.txCreator": {
        exec: async () => {},
        cases: [{ data: { message: "an error" } }],
    },
    // Unfortunately these break the test generator due to an issue with context mutation
    // DEPOSIT: { cases: [{ data: { sourceTxHash: "123" } }] },
    // DEPOSIT_UPDATE: { cases: [{ data: { sourceTxHash: "123" } }] },
    EXPIRED: {},
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
            ...testContext,
            deposit: {
                sourceTxAmount: 0,
                sourceTxHash: "",
                sourceTxConfs: 0,
                rawSourceTx: {},
            },
        } as any)
).withEvents({
    DETECTED: {},
    RESTORE: {},
    RESTORED: {},
    CONFIRMATION: {},
    CONFIRMED: {},
    REJECT: {},
    SIGNED: {},
    CLAIM: {},
    SUBMITTED: {},
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

const burnModel = createModel(
    burnMachine.withConfig(burnConfig).withContext({
        ...testContext,
        deposit: {
            sourceTxAmount: 0,
            sourceTxHash: "",
            sourceTxConfs: 0,
            rawSourceTx: {},
        },
    } as any)
).withEvents({
    RESTORE: {},
    CONFIRMATION: {},
    CONFIRMED: {},
    RELEASED: {},
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
