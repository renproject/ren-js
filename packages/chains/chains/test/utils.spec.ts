/* eslint-disable no-console */
import { RenNetwork } from "@renproject/utils";
import { expect } from "chai";
import { providers } from "ethers";
import { describe, it } from "mocha";

import {
    BinanceSmartChain,
    Bitcoin,
    BitcoinCash,
    Dogecoin,
    Ethereum,
    EVMNetworkConfig,
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

describe("BTC chain utils", () => {
    for (const ChainClass of [Bitcoin, Zcash, BitcoinCash, Dogecoin]) {
        for (const network of [RenNetwork.Mainnet, RenNetwork.Testnet]) {
            it(ChainClass.chain, () => {
                const chain = new ChainClass({ network });

                console.debug(chain.chain, network);

                expect(ChainClass.chain).not.to.equal(undefined);
                expect(ChainClass.chain).to.equal(chain.chain);

                expect(ChainClass.configMap[network].p2shPrefix).to.equal(
                    chain.network.p2shPrefix,
                );

                const address = addresses[chain.chain][network];
                const wrongAddress =
                    addresses[chain.chain][
                        network === "mainnet" ? "testnet" : "mainnet"
                    ];
                const invalidAddress = "1234";

                expect(chain.validateAddress(address)).to.equal(true);
                expect(chain.validateAddress(wrongAddress)).to.equal(false);
                expect(chain.validateAddress(invalidAddress)).to.equal(false);
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
                const provider = (
                    ChainClass.configMap[network] as EVMNetworkConfig
                ).config
                    ? new providers.JsonRpcProvider(
                          (
                              ChainClass.configMap[network] as EVMNetworkConfig
                          ).config.rpcUrls[0],
                      )
                    : undefined;
                const chain = new ChainClass({ network, provider });

                expect(ChainClass.chain).not.to.equal(undefined);
                expect(ChainClass.chain).to.equal(chain.chain);

                const address = addresses[chain.chain][network];
                const wrongAddress =
                    addresses[chain.chain][
                        network === "mainnet" ? "testnet" : "mainnet"
                    ];
                const invalidAddress = "1234";

                expect(chain.validateAddress(address)).to.equal(true);

                if (
                    ChainClass.chain !== Ethereum.chain &&
                    ChainClass.chain !== BinanceSmartChain.chain
                ) {
                    expect(chain.validateAddress(wrongAddress)).to.equal(false);
                }
                expect(chain.validateAddress(invalidAddress)).to.equal(false);
            });
        }
    }
});
