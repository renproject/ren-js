import { interpret } from "xstate";
import RenJS from "@renproject/ren";

import {
    burnMachine,
    burnConfig,
    GatewaySession,
    GatewayTransaction,
} from "../src";
import { LockChain, MintChain, TxStatus } from "@renproject/interfaces";
import { RenVMProvider } from "@renproject/rpc/build/main/v1";
import { AbstractRenVMProvider } from "@renproject/rpc";
import { fromHex } from "@renproject/utils";
import BigNumber from "bignumber.js";

require("dotenv").config();
const providers = {
    testDestChain: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
};

const confirmationRegistry: number[] = [];

function buildMockLockChain(conf = { targetConfirmations: 500 }) {
    const id = confirmationRegistry.length;
    confirmationRegistry[id] = 0;
    const transactionConfidence = () => {
        return {
            current: confirmationRegistry[id],
            target: conf.targetConfirmations,
        };
    };

    const mockLockChain: LockChain = {
        name: "mockLockChain",
        assetDecimals: () => 1,
        addressIsValid: () => true,
        transactionID: () =>
            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
        transactionConfidence,
        addressStringToBytes: (x) => Buffer.from(x),
        initialize: () => {
            return mockLockChain;
        },
        getDeposits: async (_a, _b, _c, onDeposit) => {
            onDeposit({ transaction: {}, amount: "1" });
        },
        getGatewayAddress: () => "gatewayaddr",
        getPubKeyScript: () => Buffer.from("pubkey"),
        depositV1HashString: () => "v1hashstring",
        legacyName: "Btc",
        assetIsNative: () => true,
        transactionRPCFormat: () => ({
            txid: fromHex(
                "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
            ),
            txindex: "0",
        }),
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
        resolveTokenGatewayContract: async () =>
            "0x0000000000000000000000000000000000000000",
        submitMint: (_asset, _calls, _tx, emitter) => {
            setTimeout(() => {
                emitter.emit(
                    "transactionHash",
                    "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                );
            }, 100);
        },
        findBurnTransaction: (_p, _d, emitter) => {
            setTimeout(() => {
                emitter.emit(
                    "transactionHash",
                    "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                );
            }, 1000);

            return {
                transaction: {
                    hash:
                        "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                },
                amount: new BigNumber(0),
                to: "toAddress",
                nonce: new BigNumber(0),
            };
        },
        findTransaction: () => "mintTxHash",
        transactionRPCFormat: () => ({
            txid: fromHex(
                "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
            ),
            txindex: "0",
        }),
        contractCalls: async () => [
            {
                sendTo: "0x0000000000000000000000000000000000000000",
                contractFn: "nop",
            },
        ],
    };
    return { mockMintChain, state };
}

const mintTransaction: GatewaySession = {
    id: "a unique identifier",
    type: "burn",
    network: "testnet",
    sourceAsset: "renBTC",
    sourceNetwork: "testSourceChain",
    destAddress: "0x0000000000000000000000000000000000000000",
    destNetwork: "testDestChain",
    destConfsTarget: 6,
    targetAmount: 1,
    userAddress: "0x0000000000000000000000000000000000000000",
    expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
    transactions: {},
    customParams: {},
};

jest.setTimeout(1000 * 46);
describe("BurnMachine", function () {
    it("should create a burn tx", async () => {
        const fromChainMap = {
            testSourceChain: () => {
                return buildMockMintChain().mockMintChain;
            },
        };

        const toChainMap = {
            testDestChain: () => {
                return buildMockLockChain().mockLockChain;
            },
        };

        const machine = burnMachine.withConfig(burnConfig).withContext({
            tx: mintTransaction,
            sdk: new RenJS("testnet"),
            providers,
            fromChainMap,
            toChainMap,
        });
        let result: any = {};

        const p = new Promise<any>((resolve) => {
            const service = interpret(machine)
                .onTransition((state) => {
                    if (state.value === "srcSettling") {
                        // we have successfully created a burn tx
                        result = state;
                        service.send("CONFIRMED");
                    }
                    if (state.value === "srcConfirmed") {
                        service.stop();
                    }
                })
                .onStop(() => console.log("Interpreter stopped"));

            // Start the service
            service.start();
            service.subscribe(((state: any, evt: any) => {}) as any);
            service.onStop(() => {
                resolve(result);
                console.log("Service stopped");
            });
        });
        return p.then((state) => {
            expect(
                Object.keys(state.context?.tx?.transactions || {}).length,
            ).toBeGreaterThan(0);
        });
    });
});
