import { expect } from "earljs";

import * as filscan from "../src/api/filscan";
import * as filscout from "../src/api/filscout";

require("dotenv").config();

describe("Filscout", () => {
    it("Can fetch messages", async () => {
        const messages = await filscout.fetchDeposits(
            "t1zl3sj2t7eazaojiqytccq4zlwosjxixsnf4rhyy",
            Buffer.from("Hello world!").toString("base64")
        );

        expect(messages.length).toEqual(1);
    });
});

describe.only("FilScan", () => {
    it("Can fetch messages", async () => {
        const messages = await filscan.fetchDeposits(
            "t1zl3sj2t7eazaojiqytccq4zlwosjxixsnf4rhyy",
            Buffer.from("Hello world!").toString("base64")
        );

        expect(messages.length).toEqual(1);
    });
});
