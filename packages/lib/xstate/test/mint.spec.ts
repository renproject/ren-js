import * as chai from "chai";
import { renTestnet } from "@renproject/networks";
import RenJS from "@renproject/ren";
import { interpret } from "xstate";
import { mintMachine, mintConfig } from "../src";
import HDWalletProvider from "truffle-hdwallet-provider";
import {
    Bitcoin,
    BinanceSmartChain,
    Ethereum,
    Zcash,
    BitcoinCash,
} from "@renproject/chains";
import CryptoAccount from "send-crypto";
import { GatewaySession } from "../src/types/transaction";

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;
console.log(MNEMONIC, PRIVATE_KEY);

require("dotenv").config();

const expect = chai.expect;

describe("MintMachine", function () {
    this.timeout(0);
    it("true", () => {
        expect(true).to.eq(true);
    });
    it("listen for deposits for a valid machine", function (done) {
        this.timeout(0);

        const account = new CryptoAccount(PRIVATE_KEY, { network: "testnet" });

        // A mapping of how to construct parameters for host chains,
        // based on the destination network
        const toChainMap = {
            binanceSmartChain: (context) => {
                const { destAddress, destNetwork } = context.tx;
                const { providers } = context;
                return new BinanceSmartChain(providers[destNetwork]).Account({
                    address: destAddress,
                });
            },
            ethereum: (context) => {
                const { destAddress, destNetwork } = context.tx;
                const { providers } = context;

                return Ethereum(providers[destNetwork]).Account({
                    address: destAddress,
                });
            },
        };

        // A mapping of how to construct parameters for source chains,
        // based on the source network
        const fromChainMap = {
            bitcoin: () => Bitcoin(),
            zcash: () => Zcash(),
            bitcoinCash: () => BitcoinCash(),
        };

        const infuraURL = `${renTestnet.infura}/v3/${process.env.INFURA_KEY}`; // renBscTestnet.infura
        const provider = new HDWalletProvider(MNEMONIC, infuraURL, 0, 10);
        const blockChainProviders = {
            ethereum: provider,
        };

        const mintTransaction: GatewaySession = {
            id: "auniqueidforthetx",
            type: "mint",
            network: "testnet",
            sourceAsset: "btc",
            sourceNetwork: "bitcoin",
            destAddress: provider.addresses[0], //"address to mint to",
            destAsset: "renBTC",
            destNetwork: "ethereum",
            destConfsTarget: 6,
            targetAmount: 1,
            userAddress: provider.addresses[0],
            expiryTime: new Date().getTime() + 1000 * 60 * 60 * 24,
            transactions: {},
        };

        const machine = mintMachine.withConfig(mintConfig).withContext({
            tx: mintTransaction,
            sdk: new RenJS("testnet"),
            providers: blockChainProviders,
            fromChainMap,
            toChainMap,
        });

        // Interpret the machine, and add a listener for whenever a transition occurs.
        // The machine will detect which state the transaction should be in,
        // and perform the neccessary next actions
        const p = new Promise((resolve, reject) => {
            const service = interpret(machine)
                .onTransition((state) => {
                    if (state.context.tx.suggestedAmount) {
                        const suggestedAmount =
                            state.context.tx.suggestedAmount;
                        // account
                        //     .sendSats(
                        //         state.context.tx.gatewayAddress,
                        //         suggestedAmount,
                        //         state.context.tx.sourceAsset
                        //     )
                        //     .catch(reject);
                    }
                    console.log("value", state.value);
                    if (state.value === "requestingSignature") {
                        // implement logic to determine whether deposit is valid and should be signed
                        // then call
                        resolve();
                        // service.send("SIGN");
                    }
                })
                .onEvent(console.log)
                .onStop(() => console.log("stopped?"));

            // Start the service
            service.start();
            service.onStop(() => console.log("outhersop"));
        });
        const r = p;
        console.log("r", r);
        return p.then((d) => {
            console.log('"done"');
            expect(p).to.throw();
            done();
        });
    });
    it("false", () => {
        expect(true).to.eq(false);
    });
});
