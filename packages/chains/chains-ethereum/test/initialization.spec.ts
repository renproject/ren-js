/* eslint-disable no-console */

import { join } from "path";

import { RenNetwork } from "@renproject/utils";
import chai, { expect } from "chai";
import { config as loadDotEnv } from "dotenv";

import { Ethereum } from "../src/ethereum";

loadDotEnv({ path: join(__dirname, "../../../../.env") });

chai.should();

describe("Initialization", () => {
    it("Initialize with correct testnet", async () => {
        const mainnet = new Ethereum({
            network: RenNetwork.Mainnet,
            provider: "",
            defaultTestnet: "goerli",
        });

        expect(mainnet.configMap.mainnet.selector).to.equal("Ethereum");
        expect(mainnet.assets.ETH).to.equal("ETH");

        const goerli = new Ethereum({
            network: RenNetwork.Testnet,
            provider: "",
            defaultTestnet: "goerli",
        });

        expect(goerli.configMap.testnet.selector).to.equal("Goerli");
        expect(goerli.assets.ETH).to.equal("gETH");
    });
});
