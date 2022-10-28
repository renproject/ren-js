/* eslint-disable no-console */

import { join } from "path";

import { RenNetwork } from "@renproject/utils";
import chai, { expect } from "chai";
import { config as loadDotEnv } from "dotenv";

import { Goerli, resolveRpcEndpoints } from "../src";

loadDotEnv({ path: join(__dirname, "../../../../.env") });

chai.should();

describe("asset", () => {
    it("Fetch lock and mint assets", async () => {
        const chain = new Goerli({
            provider: resolveRpcEndpoints(
                Goerli.configMap["testnet"].config.rpcUrls,
                {
                    INFURA_API_KEY: process.env.INFURA_KEY,
                },
            )[0],
            network: RenNetwork.Testnet,
            defaultTestnet: "goerli",
        });

        expect(await chain.getLockAsset("DAI_Goerli")).to.not.be.empty;
        expect(await chain.getLockAsset("USDC_Goerli")).to.not.be.empty;
        expect(await chain.getLockAsset("REN_Goerli")).to.not.be.empty;
        expect(await chain.getLockAsset("USDT_Goerli")).to.not.be.empty;
    });
});
