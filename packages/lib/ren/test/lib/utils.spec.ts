// tslint:disable: no-console

import { EthArgs, strip0x, Tokens } from "@renproject/interfaces";
import {
    BURN_TOPIC, generateAddress, generateGHash, generatePHash, NetworkChaosnet, NetworkDevnet,
    NetworkLocalnet, NetworkTestnet,
} from "@renproject/utils";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

import RenJS from "../../src";

chai.use(chaiAsPromised);
chai.should();

require("dotenv").config();

const NETWORK = process.env.NETWORK;

describe("Utils", function () {
    // Disable test timeout.
    this.timeout(0);

    it("generatePHash", () => {
        const expectedPHash = "0x65749241113ce04d4242ca414a5ba67c27eea1e74a5540367a1726770700bae2";
        const payload: EthArgs = [{
            name: "_shifter",
            type: "address",
            value: "0x8a0E8dfC2389726DF1c0bAB874dd2C9A6031b28f"
        },
        {
            name: "_address",
            type: "address",
            value: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B"
        }];

        generatePHash(payload).should.equal(expectedPHash);
    });

    it("Burn Topic hash", () => {
        BURN_TOPIC
            .should.equal("0x2275318eaeb892d338c6737eebf5f31747c1eab22b63ccbc00cd93d4e785c116");
    });

    const testcases = [
        // { name: "mainnet", network: NetworkMainnet, expectedHash: "", expectedAddress: "" },
        { name: "chaosnet", network: NetworkChaosnet, expectedHash: "0x3bca438afb8eac25dd98dfa67347f1c6aac8f9102b4c10c3272a7c3aaa2046a9", expectedAddress: "35KV2vwTMi6LRNLZ9NAAGpjPzzQfN7uAzP" },
        { name: "testnet", network: NetworkTestnet, expectedHash: "0x81ec041a5c61de9f325b337a6e4df29d12aeef7d1fb62d7230ea87e112c7460c", expectedAddress: "2Mu9y93vrAF6C5Eps8mJQvamVhqE9B3TVCs" },
        { name: "devnet", network: NetworkDevnet, expectedHash: "0x801702fa5c5604dd2e22465986f515567ff1a04e6b7a10eb3f605e28b038c031", expectedAddress: "2N9xBcd9T9D1Lzz3ZVj2izspFY7dgcRKJRw" },
        { name: "localnet", network: NetworkLocalnet, expectedHash: "0x14b37a9ea93aece89a5c696544bcb713050bc07b87bc375acaa4ddd9cda41c11", expectedAddress: "2MyZ6nWRCmpdsxvtf1G3LiFgGHnZKvN17Pj" },
    ];

    for (const testcase of testcases) {
        it(`generateGHash for ${testcase.name}`, () => {
            const payload: EthArgs = [{
                name: "_shifter",
                type: "address",
                value: "0x8a0E8dfC2389726DF1c0bAB874dd2C9A6031b28f"
            },
            {
                name: "_address",
                type: "address",
                value: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B"
            }];

            const amount = 22500;
            const to = "0xC99Ab5d1d0fbf99912dbf0DA1ADC69d4a3a1e9Eb";
            const nonce = "0x3205f743e45858d2a797a88d867264ab9d3b310fc0853056cdd92d9b1b4bd1d5";

            generateGHash(payload, /*amount,*/ strip0x(to), Tokens.BTC.Btc2Eth, nonce, testcase.network)
                .should.equal(testcase.expectedHash);
        });

        it(`generateAddress ${testcase.name}`, () => {
            generateAddress(Tokens.BTC.Btc2Eth, testcase.expectedHash, testcase.network)
                .should.equal(testcase.expectedAddress);
        });
    }

    it(`queryTX`, async () => {
        // tslint:disable-next-line: await-promise
        await new RenJS(NETWORK).renVM.queryTX("0")
            .should.be.rejectedWith(/Node returned status 404 with reason: tx hash=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= not found/);
    });

    // it.skip("fixSignature", () => {
    //     const response: UnmarshalledTx = {
    //         to: RenContract.Btc2Eth,
    //         txStatus: TxStatus.TxStatusDone,
    //         hash: "0xec7f5d0fc132d87ff65095f9caee08be659a9b7f5b9bd2250291c94bb5d94801",
    //         in: {
    //             phash: "0xacb3833774a06f15079030f357276c71faabb1f006f804c80ded65782453f5e9",
    //             token: "0x916b8012e1813e5924a3eca400dbe6c7055a8484",
    //             to: "0xc99ab5d1d0fbf99912dbf0da1adc69d4a3a1e9eb",
    //             n: "0xc90399b95e4614dc60a212a987e6a71f1574605936713b97313299aee7dfcd90",
    //             utxo: {
    //                 amount: "14999",
    //                 scriptPubKey: "qRSgMyIWk6jew6wDt7Za2oV68oBdc4c=",
    //                 txHash: "Zdpl+CoLsDqEH7yIhXYxv43lFkkj0eQS84YEax9cS+w=",
    //                 vOut: 0
    //             },
    //             amount: "14999",
    //         },
    //         autogen: {
    //             ghash: "0x6b622afc190d985b5a26f15df93396ea5ba5cbdda9652423bf53e243d76f688d",
    //             nhash: "0x57b161e0fcf308b177e5ad67bb63e47b294cf8055d5bdf96217068e101c59b22",
    //             sighash: "0x465579a1833f92c992d9731d8dbcddca9765a93b39fb8c6653174db5b72948a1"
    //         },
    //         out: {
    //             r: "0xcff867351a7bbfef426375408673b358342f9aca753c509dc6913a74161eae86",
    //             s: "0x20cf47938793d5601b390c6e82dde674a629e68ce2c9d37cb91407a6da507d10",
    //             v: "0x01"
    //         }
    //     };

    //     console.debug(fixSignature(response, NetworkDevnet));
    // });
});
