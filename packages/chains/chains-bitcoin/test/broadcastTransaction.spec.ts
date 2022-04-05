/* eslint-disable no-console */
import { describe, it } from "mocha";

import { Blockchain, BlockchainNetwork } from "../src/APIs/blockchain";

describe.skip("broadcast transaction", () => {
    it("blockchain.com", async () => {
        const blockchain = new Blockchain(BlockchainNetwork.Bitcoin);
        console.debug(await blockchain.broadcastTransaction("123456"));
    });
});
