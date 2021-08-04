/* eslint-disable no-console */

import RenJS from "@renproject/ren";
import { EventObject, interpret, State } from "xstate";
import { config as loadDotEnv } from "dotenv";

import {
    buildBurnConfig,
    burnMachine,
    BurnMachineContext,
    BurnMachineSchema,
    buildBurnContextWithMap,
} from "../src";
import { buildMockLockChain, buildMockMintChain } from "./testutils/mock";
import { SECONDS } from "@renproject/utils";
import { BurnSession } from "../src/types/burn";
import BigNumber from "bignumber.js";

loadDotEnv();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const burnTransaction: BurnSession<any, any> = {
    id: "a unique identifier",
    network: "testnet",
    sourceAsset: "renBTC",
    sourceChain: "testSourceChain",
    destAddress: "0x0000000000000000000000000000000000000000",
    destChain: "testDestChain",
    targetAmount: "1",
    userAddress: "0x0000000000000000000000000000000000000000",
    customParams: {},
};

jest.setTimeout(1000 * 500);
describe("BurnMachine", () => {
    it("should create a burn tx", async () => {
        const fromChainMap = {
            testSourceChain: () => {
                const chain = buildMockMintChain().mockMintChain;
                chain.submitBurn = async (_p, _d, emitter) => {
                    setTimeout(() => {
                        emitter.emit(
                            "transactionHash",
                            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                        );
                    }, 100);

                    setInterval(() => {
                        emitter.emit("confirmation", 6);
                    }, 100);

                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                transaction: {
                                    hash: "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                                },
                                amount: new BigNumber(0),
                                to: "asd",
                                nonce: new BigNumber(0),
                            });
                        }, 100);
                    });
                };
                return chain;
            },
        };

        const toChainMap = {
            testDestChain: () => {
                return buildMockLockChain().mockLockChain;
            },
        };

        const machine = burnMachine.withConfig(buildBurnConfig()).withContext({
            ...buildBurnContextWithMap({
                tx: burnTransaction,
                sdk: new RenJS("testnet", {
                    networkDelay: 1 * SECONDS,
                }),
                fromChainMap,
                toChainMap,
            }),
            autoSubmit: true,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let result: any = {};

        const p = new Promise<
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            State<BurnMachineContext<any, any>, EventObject, BurnMachineSchema>
        >((resolve, reject) => {
            const service = interpret(machine)
                .onTransition((state) => {
                    console.log(state.value);
                    if ((state.value as string).includes("error")) {
                        reject(state.value);
                    }
                    if (state.value === "srcSettling") {
                        // we have successfully created a burn tx
                        result = state;
                    }
                    if (state.value === "srcConfirmed") {
                        service.stop();
                    }
                })
                .onStop(() => {
                    console.log("Interpreter stopped");
                });

            // Start the service
            service.start();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            service.subscribe(((_state: any, _evt: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any);
            service.onStop(() => {
                resolve(result);
                console.log("Service stopped");
            });
        });
        return p.then((state) => {
            expect(
                Object.keys(state.context?.tx.transaction || {}).length,
            ).toBeGreaterThan(0);
        });
    });
});
