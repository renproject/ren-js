// tslint:disable: no-console

import { fromBase64, fromHex, hash160, Ox } from "@renproject/utils";
import {
    Networks as BNetworks,
    Opcode as BOpcode,
    Script as BScript,
} from "bitcore-lib";
import {
    Networks as BCHNetworks,
    Opcode as BCHOpcode,
    Script as BCHScript,
} from "bitcore-lib-cash";
import {
    Networks as ZNetworks,
    Opcode as ZOpcode,
    Script as ZScript,
} from "bitcore-lib-zcash";
import { expect } from "earljs";
import { describe, it } from "mocha";

import * as v1 from "../src/common";
import * as v2 from "../src/commonV2";

require("dotenv").config();

describe("Common", () => {
    for (const { asset, Networks, Opcode, Script } of [
        { asset: "BTC", Networks: BNetworks, Opcode: BOpcode, Script: BScript },
        { asset: "ZEC", Networks: ZNetworks, Opcode: ZOpcode, Script: ZScript },
        {
            asset: "BCH",
            Networks: BCHNetworks,
            Opcode: BCHOpcode,
            Script: BCHScript,
        },
    ]) {
        for (const isTestnet of [true, false]) {
            it(asset, async () => {
                const gHash = fromBase64(
                    "cQ+CJ8bOP4RMopOCNDvbQ020Eu8KRpYykurZyKNFM1I="
                );

                // const selector = "BTC0Btc2Eth";
                // const publicKey = await new RenJS("testnet").renVM.selectPublicKey(
                //     selector
                // );

                const publicKey = fromHex(
                    "030dd65f7db2920bb229912e3f4213dd150e5f972c9b73e9be714d844561ac355c"
                );

                const v1Address = v1.createAddress(Networks, Opcode, Script)(
                    isTestnet,
                    Ox(hash160(publicKey)),
                    Ox(gHash)
                );
                const v1Script = v1.pubKeyScript(Networks, Opcode, Script)(
                    isTestnet,
                    Ox(hash160(publicKey)),
                    Ox(gHash)
                );

                const v2Address = v2.createAddress(Networks, Opcode, Script)(
                    isTestnet,
                    Ox(hash160(publicKey)),
                    Ox(gHash)
                );
                const v2Script = v2.pubKeyScript(Networks, Opcode, Script)(
                    isTestnet,
                    Ox(hash160(publicKey)),
                    Ox(gHash)
                );

                expect(v1Address).toEqual(v2Address);
                expect(v1Script).toEqual(v2Script);

                console.log(
                    `${asset} ${
                        isTestnet ? "testnet" : "mainnet"
                    }: ${v1Address}`
                );
            });
        }
    }
});
