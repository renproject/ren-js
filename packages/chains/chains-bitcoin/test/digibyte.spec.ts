/* eslint-disable no-console */
import { RenNetwork } from "@renproject/utils";
import { expect } from "chai";
import { describe, it } from "mocha";

import { DigiByte } from "../src";
import { APIWithPriority, BitcoinAPI } from "../src/APIs/API";

describe("DigiByte", () => {
    it("watch for deposits", async () => {
        const digibyte = new DigiByte({ network: "mainnet" });
        const providerConfig =
            digibyte.configMap[RenNetwork.Mainnet].providers[0];
        const provider: BitcoinAPI =
            (providerConfig as APIWithPriority).api ||
            (providerConfig as BitcoinAPI);

        const txs = await provider.fetchUTXOs(
            "DRNiw2k4iFuHGS2fF1wMahounXo6H9iGbh",
        );

        expect(txs[txs.length - 1]).to.deep.equal({
            txid: "9f5c0a8146e7633911cbf5be44ebebb9b65bb360511f6795bea04c650ed600b8",
            amount: "16205616929",
            txindex: "2",
            height: "3127600",
        });
    });
});
