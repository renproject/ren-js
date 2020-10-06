import { interpret } from "xstate";
const utils = jest.genMockFromModule("@renproject/utils") as any;

utils.SECONDS = 100;

import RenJS from "@renproject/ren";

import { mintMachine, mintConfig, GatewaySession } from "../src";
import { LockChain, MintChain } from "@renproject/interfaces";
import { EventEmitter } from "events";

const providers = {
    testDestChain: () => {},
};

let currentLockConfs = 0;

const mockLockChain: LockChain = {
    name: "mockLockChain",
    assetDecimals: () => 1,
    addressIsValid: () => true,
    transactionID: () => "tid",
    transactionConfidence: () => ({ current: currentLockConfs, target: 1 }),
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
let testEmitter: EventEmitter;

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
        testEmitter = emitter;
        setInterval(() => {
            currentLockConfs += 1;
            emitter.emit("confirmation", currentLockConfs);
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

const fromChainMap = {
    testSourceChain: () => {
        return mockLockChain;
    },
};

const toChainMap = {
    testDestChain: () => {
        return mockMintChain;
    },
};

const mintTransaction: GatewaySession = {
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
};

jest.setTimeout(1000 * 20);
describe("MintMachine", function () {
    it("should create a tx", async () => {
        debugger;
        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: mintTransaction,
            sdk: new RenJS("testnet"),
            providers,
            fromChainMap,
            toChainMap,
        });

        const p = new Promise((resolve) => {
            const service = interpret(machine)
                .onTransition((state) => {
                    if (Object.values(state.context.depositMachines || {})[0]) {
                        // we have successfully detected a depost and spawned
                        // a machine to listen for updates
                        resolve();
                    }
                    if (state.value === "requestingSignature") {
                        resolve();
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            service.subscribe(((state: any, evt: any) => {
                // console.log("STATE\n\n\n\n\n", state, "\n\n");
                // console.log("EVT\n\n\n\n", evt, "\n\n\n");
            }) as any);
            service.onStop(() => console.log("Service stopped"));
        });
        return p.then(() => {
            //expect().toThrow();
        });
    });
});
