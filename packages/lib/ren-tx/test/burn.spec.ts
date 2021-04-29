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
                chain.findBurnTransaction = (_p, _d, emitter) => {
                    setTimeout(() => {
                        emitter.emit(
                            "transactionHash",
                            "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                        );
                    }, 500);

                    setInterval(() => {
                        emitter.emit("confirmation", 1);
                    }, 1000);

                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                transaction: {
                                    hash:
                                        "0xb5252f4b08fda457234a6da6fd77c3b23adf8b3f4e020615b876b28aa7ee6299",
                                },
                                amount: new BigNumber(0),
                                to: "asd",
                                nonce: new BigNumber(0),
                            });
                        }, 1100);
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
        let result: any = {};

        const p = new Promise<
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
            service.subscribe(((state: any, evt: any) => {
                /* */
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
