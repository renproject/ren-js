import { expect } from "chai";
/* eslint-disable no-console */
import { describe, it } from "mocha";

import { Blockchain, BlockchainNetwork } from "../src/APIs/blockchain";

describe("broadcast transaction", () => {
    it("blockchain.com", async () => {
        const blockchain = new Blockchain(BlockchainNetwork.Bitcoin);
        console.log(await blockchain.broadcastTransaction("123456"));
    });
});
