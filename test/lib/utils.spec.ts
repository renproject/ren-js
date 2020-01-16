import chai from "chai";
import chaiAsPromised from "chai-as-promised";

import RenJS from "../../src";
import {
    BURN_TOPIC, fixSignature, generateAddress, generateGHash, generatePHash, strip0x,
} from "../../src/lib/utils";
import { Tx } from "../../src/renVM/transaction";
import { Tokens } from "../../src/types/assets";
import {
    NetworkChaosnet, NetworkDevnet, NetworkLocalnet, NetworkMainnet, NetworkTestnet,
} from "../../src/types/networks";

chai.use(chaiAsPromised);
chai.should();

describe("Utils", function () {
    // Disable test timeout.
    this.timeout(0);

    it("generatePHash", () => {
        const expectedPHash = "0x65749241113ce04d4242ca414a5ba67c27eea1e74a5540367a1726770700bae2";
        const payload = [{
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
        { name: "chaosnet", network: NetworkChaosnet, expectedHash: "0xde0f989dd17a89c6da29fae8a38e36dd8d4fd6d5416d389da7a760fc219a3010", expectedAddress: "38SYZCS9TAWxBcFyuZuweZHLVF4u2vTGxH" },
        { name: "testnet", network: NetworkTestnet, expectedHash: "0x6ac8690a3340bc5de36b39ea0a1f42a472765fd7ebe19351911e18838303dd3e", expectedAddress: "2NFHUxhcDYTc1sA9mK8go6eG1Tkb7Bqu1it" },
        { name: "devnet", network: NetworkDevnet, expectedHash: "0x4665a9c6b5286b27da5c858e465c32a1833c375d0ea7e8e98916ad735201af61", expectedAddress: "2N8uAwCEh4fsNki1bMfyjVwS6769yf2Juoa" },
        { name: "localnet", network: NetworkLocalnet, expectedHash: "0x7652644d54e47c65104a6e175117d803a8f5ffd7fdb585cf2123b81ea4ba8b27", expectedAddress: "2NCFmMCp9CbwpSBkdFkeUoAQJtDVRbCsZsP" },
    ];

    for (const testcase of testcases) {
        it(`generateGHash for ${testcase.name}`, () => {
            const payload = [{
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

            generateGHash(payload, amount, strip0x(to), Tokens.BTC.Btc2Eth, nonce, testcase.network)
                .should.equal(testcase.expectedHash);
        });

        it(`generateAddress ${testcase.name}`, () => {
            generateAddress(Tokens.BTC.Btc2Eth, testcase.expectedHash, testcase.network)
                .should.equal(testcase.expectedAddress);
        });
    }

    it(`queryTX`, async () => {
        await new RenJS("testnet").renVM.queryTX("0")
            .should.be.rejectedWith(/Node returned status 500 with reason: method=ren_queryTx not available/);
    });

    it.skip("fixSignature", () => {
        const response: Tx = {
            hash: "0xec7f5d0fc132d87ff65095f9caee08be659a9b7f5b9bd2250291c94bb5d94801",
            args: {
                phash: "0xacb3833774a06f15079030f357276c71faabb1f006f804c80ded65782453f5e9",
                token: "0x916b8012e1813e5924a3eca400dbe6c7055a8484",
                to: "0xc99ab5d1d0fbf99912dbf0da1adc69d4a3a1e9eb",
                n: "0xc90399b95e4614dc60a212a987e6a71f1574605936713b97313299aee7dfcd90",
                utxo: {
                    amount: 14999,
                    ghash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                    scriptPubKey: "qRSgMyIWk6jew6wDt7Za2oV68oBdc4c=",
                    txHash: "Zdpl+CoLsDqEH7yIhXYxv43lFkkj0eQS84YEax9cS+w=",
                    vOut: 0
                },
                ghash: "0x6b622afc190d985b5a26f15df93396ea5ba5cbdda9652423bf53e243d76f688d",
                nhash: "0x57b161e0fcf308b177e5ad67bb63e47b294cf8055d5bdf96217068e101c59b22",
                amount: 14999,
                hash: "0x465579a1833f92c992d9731d8dbcddca9765a93b39fb8c6653174db5b72948a1"
            },
            signature: {
                r: "0xcff867351a7bbfef426375408673b358342f9aca753c509dc6913a74161eae86",
                s: "0x20cf47938793d5601b390c6e82dde674a629e68ce2c9d37cb91407a6da507d10",
                v: "0x01"
            }
        };

        console.log(fixSignature(response, NetworkDevnet));
    });
});
