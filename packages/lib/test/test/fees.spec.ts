/* eslint-disable no-console */

import chai, { expect } from "chai";
import { config as loadDotEnv } from "dotenv";
import { ethers } from "ethers";

import { Polygon, Terra } from "@renproject/chains";
import { RenNetwork } from "@renproject/interfaces";
import RenJS from "@renproject/ren";

chai.should();
loadDotEnv();

describe("Fees", () => {
    it("fees can be fetched", async function () {
        this.timeout(100000000000);

        const network = RenNetwork.Mainnet;

        const ethNetwork = Polygon.configMap[network];

        const infuraURL = ethNetwork.publicProvider({
            infura: process.env.INFURA_KEY,
        });
        const polygonProvider = new ethers.providers.JsonRpcProvider(infuraURL);

        const renJS = new RenJS("mainnet");
        const fees = await renJS.getFees({
            asset: "LUNA",
            from: Terra(),
            to: Polygon(polygonProvider, "mainnet"),
        });

        console.log(fees.lock.toFixed());
        // console.log(fees.release.toFixed());

        expect(fees.mint).to.be.greaterThan(5).and.lessThan(30);
        expect(fees.burn).to.be.greaterThan(5).and.lessThan(30);
        expect(fees.lock.isGreaterThan(0)).to.be.true;
        expect(fees.release.isGreaterThan(0)).to.be.true;
    });
});
