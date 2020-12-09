/* eslint-disable no-console */
import { RenNetwork } from "@renproject/interfaces";
import { describe, it } from "mocha";
import { expect } from "chai";

import {
    BinanceSmartChain,
    Bitcoin,
    BitcoinCash,
    Dogecoin,
    Ethereum,
    Zcash,
} from "../src";

const addresses = {
    [Bitcoin.chain]: {
        [RenNetwork.Mainnet]: "12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX",
        [RenNetwork.Testnet]: "n3GNqMveyvaPvUbH469vDRadqpJMPc84JA",
    },
    [Zcash.chain]: {
        [RenNetwork.Mainnet]: "t3Vz22vK5z2LcKEdg16Yv4FFneEL1zg9ojd",
        [RenNetwork.Testnet]: "t2UNzUUx8mWBCRYPRezvA363EYXyEpHokyi",
    },
    [Dogecoin.chain]: {
        [RenNetwork.Mainnet]: "DLAznsPDLDRgsVcTFWRMYMG5uH6GddDtv8",
        [RenNetwork.Testnet]: "noBEfr9wTGgs94CdGVXGYwsQghEwBsXw4K",
    },
    [BitcoinCash.chain]: {
        [RenNetwork.Mainnet]:
            "bitcoincash:qqgekzvw96vq5g57zwdfa5q6g609rrn0ycp33uc325",
        [RenNetwork.Testnet]:
            "bchtest:qrhfzqeen0a59gy3576n00k54p2ja9s3egxdkyy7hr",
    },
    [Dogecoin.chain]: {
        [RenNetwork.Mainnet]: "DLAznsPDLDRgsVcTFWRMYMG5uH6GddDtv8",
        [RenNetwork.Testnet]: "noBEfr9wTGgs94CdGVXGYwsQghEwBsXw4K",
    },
    [Ethereum.chain]: {
        [RenNetwork.Mainnet]: "0x05a56e2d52c817161883f50c441c3228cfe54d9f",
        [RenNetwork.Testnet]: "0x05a56e2d52c817161883f50c441c3228cfe54d9f",
    },
    [BinanceSmartChain.chain]: {
        [RenNetwork.Mainnet]: "0x05a56e2d52c817161883f50c441c3228cfe54d9f",
        [RenNetwork.Testnet]: "0x05a56e2d52c817161883f50c441c3228cfe54d9f",
    },
};

describe("Chain utils", () => {
    for (const ChainClass of [Bitcoin, Zcash, BitcoinCash, Dogecoin]) {
        for (const network of [RenNetwork.Mainnet, RenNetwork.Testnet]) {
            it(ChainClass.chain, () => {
                const chain = new ChainClass();
                chain.initialize(network);

                console.log(chain.name, network);

                expect(ChainClass.utils).not.to.equal(undefined);
                expect(chain.utils).not.to.equal(undefined);

                expect(ChainClass.utils.p2shPrefix).to.equal(
                    chain.utils.p2shPrefix,
                );

                const address = addresses[chain.chain][network];
                const wrongAddress =
                    addresses[chain.chain][
                        network === "mainnet" ? "testnet" : "mainnet"
                    ];
                const invalidAddress = "1234";

                expect(
                    ChainClass.utils.addressIsValid(
                        address,
                        network as "mainnet" | "testnet",
                    ),
                ).to.equal(true);

                expect(chain.utils.addressIsValid(address)).to.equal(true);

                expect(chain.utils.addressIsValid(wrongAddress)).to.equal(
                    false,
                );
                expect(chain.utils.addressIsValid(invalidAddress)).to.equal(
                    false,
                );
            });
        }
    }
});

describe("Chain utils", () => {
    for (const ChainClass of [
        Bitcoin,
        Zcash,
        BitcoinCash,
        Dogecoin,
        Ethereum,
        BinanceSmartChain,
    ]) {
        for (const network of [RenNetwork.Mainnet, RenNetwork.Testnet]) {
            it(ChainClass.chain, () => {
                const chain = new ChainClass(undefined, network);
                chain.initialize(network);

                expect(ChainClass.utils).not.to.equal(undefined);
                expect(chain.utils).not.to.equal(undefined);

                const address = addresses[chain.chain][network];
                const wrongAddress =
                    addresses[chain.chain][
                        network === "mainnet" ? "testnet" : "mainnet"
                    ];
                const invalidAddress = "1234";

                expect(
                    ChainClass.utils.addressIsValid(
                        address,
                        network as "mainnet" | "testnet",
                    ),
                ).to.equal(true);

                expect(chain.utils.addressIsValid(address)).to.equal(true);

                console.log(chain.name, network);
                if (
                    ChainClass.chain !== Ethereum.chain &&
                    ChainClass.chain !== BinanceSmartChain.chain
                ) {
                    expect(chain.utils.addressIsValid(wrongAddress)).to.equal(
                        false,
                    );
                }
                expect(chain.utils.addressIsValid(invalidAddress)).to.equal(
                    false,
                );
            });
        }
    }
});

// TODO: Move to Ethereum tests.
describe("Ethereum utils", () => {
    it("addressIsValid", () => {
        expect(
            Ethereum.utils.addressIsValid(
                "0x05a56E2D52c817161883f50c441c3228CFe54d9f",
            ),
        ).to.equal(true);

        expect(
            Ethereum.utils.addressIsValid(
                "0x05a56e2d52c817161883f50c441c3228cfe54d9f",
            ),
        ).to.equal(true);

        // ENS domain
        expect(Ethereum.utils.addressIsValid("vitalik.eth")).to.equal(true);

        // Bad casing

        expect(
            Ethereum.utils.addressIsValid(
                "0x05a56E2D52c817161883f50c441c3228CFe54d9F",
            ),
        ).to.equal(false);

        // Too short.
        expect(Ethereum.utils.addressIsValid("0x05a56E2D52c81")).to.equal(
            false,
        );

        // Not an ENS domain
        expect(Ethereum.utils.addressIsValid("vitalik.ethos")).to.equal(false);
    });
});
