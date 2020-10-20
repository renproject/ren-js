import { extractError } from "@renproject/utils";
import { expect } from "earljs";

import { TerraNetwork } from "../src/api/deposit";
import { terraDev } from "../src/api/terraDev";

require("dotenv").config();

describe("Terra.dev", () => {
    it("Can fetch addresses' txs", async () => {
        let messages;
        try {
            messages = await terraDev.fetchDeposits(
                "terra1muzv5awgfnavnelcc79c2rptp6jj085r7hsg7c",
                TerraNetwork.Tequila, // isTestnet
                ""
                // Buffer.from("Hello world!").toString("base64")
            );
        } catch (error) {
            error.message = extractError(error);
            throw error;
        }

        expect(messages.length).toEqual(3);
    });

    it("Can fetch addresses' txs filtered by memo", async () => {
        let messages;
        try {
            messages = await terraDev.fetchDeposits(
                "terra1muzv5awgfnavnelcc79c2rptp6jj085r7hsg7c",
                TerraNetwork.Tequila, // isTestnet
                "test123"
                // Buffer.from("Hello world!").toString("base64")
            );
        } catch (error) {
            error.message = extractError(error);
            throw error;
        }

        expect(messages.length).toEqual(1);
    });

    it("Can fetch a transaction's details", async () => {
        let message;
        try {
            message = await terraDev.fetchDeposit(
                "6BCF73C2518412BE1180D9D811E758F29AC46CAB0271CB47E1A852F787FDD42A",
                0,
                TerraNetwork.Tequila // isTestnet
            );
        } catch (error) {
            error.message = extractError(error);
            throw error;
        }

        expect(message.memo).toEqual("test123");
    });
});
