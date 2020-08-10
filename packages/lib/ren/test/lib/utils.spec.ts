// tslint:disable: no-console

import {
    renChaosnet,
    renDevnet,
    renLocalnet,
    renTestnet,
} from "@renproject/contracts";
import { EthArgs, Tokens } from "@renproject/interfaces";
import {
    BURN_TOPIC,
    generateAddress,
    generateGHash,
    generatePHash,
    strip0x,
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
        const expectedPHash =
            "0x65749241113ce04d4242ca414a5ba67c27eea1e74a5540367a1726770700bae2";
        const payload: EthArgs = [
            {
                name: "_gateway",
                type: "address",
                value: "0x8a0E8dfC2389726DF1c0bAB874dd2C9A6031b28f",
            },
            {
                name: "_address",
                type: "address",
                value: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B",
            },
        ];

        generatePHash(payload).should.equal(expectedPHash);
    });

    it("Burn Topic hash", () => {
        BURN_TOPIC.should.equal(
            "0x1619fc95050ffb8c94c9077c82b3e1ebbf8d571b6234241c55ba0aaf40da019e",
        );
    });

    const testcases = [
        // { name: "mainnet", network: NetworkMainnet, expectedHash: "", expectedAddress: "" },
        {
            name: "chaosnet",
            network: renChaosnet,
            expectedHash:
                "0x94e6111ba16ef879b33de88e4a8f98f11211721983dde525d9922e7ac33dc64a",
            expectedAddress: "36PoEz39mnYmWC3WGdiFyKAmCtRTTunzs3",
        },
        {
            name: "testnet",
            network: renTestnet,
            expectedHash:
                "0xd63c52983659035b6d092dfa5c1eee81b968caf8d97d90a3b58ed61dedcd59a3",
            expectedAddress: "2Mtc7uY9qrsfuP1WpPLzLNc9nR4DXvs5icg",
        },
        {
            name: "devnet",
            network: renDevnet,
            expectedHash:
                "0x4793980dbae1228bbd5df742b892a348006fd4dc3553e4b3afa94c4629b2ba7a",
            expectedAddress: "2NE1UpF7AatbiiuJDhruSCN3RfcDbdPnPyd",
        },
        {
            name: "localnet",
            network: renLocalnet,
            expectedHash:
                "0x685725b3d6d11d846be676b26f9357543e6d18044e6b09ca2b3af0f96e5e8d2b",
            expectedAddress: "2N3NC9ERzWj6sY49z6LZM1TLGj9bzvke8Ma",
        },
    ];

    for (const testcase of testcases) {
        it(`generateGHash for ${testcase.name}`, () => {
            const payload: EthArgs = [
                {
                    name: "_gateway",
                    type: "address",
                    value: "0x8a0E8dfC2389726DF1c0bAB874dd2C9A6031b28f",
                },
                {
                    name: "_address",
                    type: "address",
                    value: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B",
                },
            ];

            const amount = 22500;
            const to = "0xC99Ab5d1d0fbf99912dbf0DA1ADC69d4a3a1e9Eb";
            const nonce =
                "0x3205f743e45858d2a797a88d867264ab9d3b310fc0853056cdd92d9b1b4bd1d5";

            generateGHash(
                payload,
                /*amount,*/ strip0x(to),
                Tokens.BTC.Btc2Eth,
                nonce,
                testcase.network,
            ).should.equal(testcase.expectedHash);
        });

        it(`generateAddress ${testcase.name}`, () => {
            // generateAddress(Tokens.BTC.Btc2Eth, testcase.expectedHash, testcase.network.isTestnet)
            // .should.equal(testcase.expectedAddress);
        });
    }

    it(`queryTX`, async () => {
        // tslint:disable-next-line: await-promise
        await new RenJS(NETWORK).renVM
            .queryMintOrBurn("0")
            .should.be.rejectedWith(
                /tx hash=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= not found/,
            );
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
