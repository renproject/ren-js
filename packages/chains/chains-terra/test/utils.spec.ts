import { expect } from "chai";

import { Terra } from "../src";

describe("Utils", () => {
    it("validateTransaction", () => {
        const terra = new Terra({
            network: "testnet",
        });

        expect(
            terra.validateTransaction({
                txHash: "79EC7C5DBA526D3C3B7CCCFFDA1B06F16D3E2402A3D6B82D7D251F26B68C4489",
            }),
        ).to.be.true;

        expect(
            terra.validateTransaction({
                txHash: "79EC7C5DBA526D3C3B7CCCFFDA1B06F16D3E2402A3D6B82D7D251F26B68C4489",
                txid: "eex8XbpSbTw7fMz_2hsG8W0-JAKj1rgtfSUfJraMRIk",
                txindex: "0",
            }),
        ).to.be.true;
    });
});
