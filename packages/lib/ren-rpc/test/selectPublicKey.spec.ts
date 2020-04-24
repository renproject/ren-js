import { RenContract } from "@renproject/interfaces";
import { Ox } from "@renproject/utils";
import chai from "chai";

import { RenVMProvider } from "../build/main";

chai.should();

require("dotenv").config();

const response = {
    "shards": [
        {
            "darknodesRootHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "gateways": [
                {
                    "asset": "BTC",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "100",
                    "origin": "Bitcoin",
                    "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
                },
                {
                    "asset": "ZEC",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "200",
                    "origin": "Zcash",
                    "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
                },
                {
                    "asset": "BCH",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "200",
                    "origin": "BitcoinCash",
                    "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
                }
            ],
            "gatewaysRootHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "primary": true,
            "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
        },
        {
            "darknodesRootHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "gateways": [
                {
                    "asset": "BTC",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "10",
                    "origin": "Bitcoin",
                    "pubKey": "AvAE1xNO07YqC7WoFeS5OqSOiRKKTkA0ampJIJ694Os7"
                },
                {
                    "asset": "ZEC",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "20",
                    "origin": "Zcash",
                    "pubKey": "AvAE1xNO07YqC7WoFeS5OqSOiRKKTkA0ampJIJ694Os7"
                },
                {
                    "asset": "BCH",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "20",
                    "origin": "BitcoinCash",
                    "pubKey": "AvAE1xNO07YqC7WoFeS5OqSOiRKKTkA0ampJIJ694Os7"
                }
            ],
            "gatewaysRootHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "primary": true,
            "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
        },
        {
            "darknodesRootHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "gateways": [
                {
                    "asset": "BTC",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "50",
                    "origin": "Bitcoin",
                    "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
                },
                {
                    "asset": "ZEC",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "100",
                    "origin": "Zcash",
                    "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
                },
                {
                    "asset": "BCH",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "100",
                    "origin": "BitcoinCash",
                    "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
                }
            ],
            "gatewaysRootHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "primary": true,
            "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
        },
        {
            "darknodesRootHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "gateways": [
                {
                    "asset": "BTC",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "0",
                    "origin": "Bitcoin",
                    "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
                },
                {
                    "asset": "ZEC",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "0",
                    "origin": "Zcash",
                    "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
                },
                {
                    "asset": "BCH",
                    "hosts": [
                        "Ethereum"
                    ],
                    "locked": "0",
                    "origin": "BitcoinCash",
                    "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
                }
            ],
            "gatewaysRootHash": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "primary": false,
            "pubKey": "AiNZMfn6XPOgkylbtWtXt2OWznYoR1E1TtNAk3Du5Bxd"
        }
    ]
};

describe("RenVMProvider", () => {
    it("selectPublicKey", async () => {
        const renVMProvider = new RenVMProvider({ sendMessage: () => response } as any); // tslint:disable-line: no-any
        Ox((await renVMProvider.selectPublicKey(RenContract.Btc2Eth)))
            .should.equal("0xe771b00d9f6d7125af80281ad778123ba468f1f2");
    });
});
