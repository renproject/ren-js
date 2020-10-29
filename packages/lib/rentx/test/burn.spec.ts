// tslint:disable: no-console

import RenJS from "@renproject/ren";
import { interpret } from "xstate";

import { burnConfig, burnMachine, GatewaySession } from "../src";
import { buildMockLockChain, buildMockMintChain } from "./testutils/mock";

require("dotenv").config();
const providers = {
    testDestChain: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
};

const mintTransaction: GatewaySession = {
    id: "a unique identifier",
    type: "burn",
    network: "testnet",
    sourceAsset: "renBTC",
    sourceNetwork: "testSourceChain",
    destAddress: "0x0000000000000000000000000000000000000000",
    destAsset: "BTC",
    destNetwork: "testDestChain",
    destConfsTarget: 6,
    targetAmount: 1,
    userAddress: "0x0000000000000000000000000000000000000000",
    expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
    transactions: {},
};

jest.setTimeout(1000 * 46);
describe("BurnMachine", () => {
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
                Object.keys(state.context?.tx?.transactions || {}).length,
            ).toBeGreaterThan(0);
        });
    });
});
