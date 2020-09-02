// tslint:disable: no-console

import BigNumber from "bignumber.js";
import { expect } from "earljs";
import { describe, it } from "mocha";

import { unmarshalPackValue } from "../src/v2/pack/pack";
import { burnParamsType, mintParamsType } from "../src/v2/transaction";

require("dotenv").config();

describe("Pack", () => {
    it("Unmarshal burn", () => {
        const amount =
            "51423850459342719531259112406474019285406140697150570331000675381551947991775";
        const nonce = "H8AmOgjiSt8ULnuw1mDzPMJogHDOS2J1uNELrDma0xg";
        const to = "􂜇𚧦󫰀";
        const token =
            "򰕴𐫦􄣗񵈨𡮻􏞈󨮅󚍡񿋦񌲴򤈭񊖶𿓇󅎴񂧪𵊢􉨸򬋼𛭓𒃄󩚜힌콊񦦥󙬼󞣤򳑿𨇬𮄘􈰚󅃓𚰎񔦷򥑩󥗰򑣬򛫗򇲎᛽󟛵󌲔𖊰񹶞ᭇ񷫰򄖈􆟰񮣌񸊛𑦲𡆯򛽞񷎆򾀭𚫼𒅙񙙭𱂳󿩨򤘓󌲲򀭒񔶥񦍜񹴷򌛥񙦘🝁";

        const result = unmarshalPackValue(burnParamsType, {
            amount,
            nonce,
            to,
            token,
        });
        expect(result).toEqual({
            amount: new BigNumber(amount),
            nonce: Buffer.from(nonce, "base64"),
            to: Buffer.from(to),
            token: Buffer.from(token),
        });
    });

    it("Unmarshal burn", () => {
        const ghash = "x0gTBzbXmM1Xdwk-B8PHJ4sgY2T_NcrWsxK6MJ2xYos";
        const gpubkey = "8Qnq";
        const nhash = "a_46LkThVhVYlkIxBXaInubuEmYcfDNk45EBl60prhA";
        const nonce = "vPIiF6apzdJ4Rr8IMpT2uywo8LbuHOcaEXQ21ydXFBA";
        const hash = "_yJG1tKIALMrvaSes9BB4dYx5eCN8OK5V_PEM4N3R10";
        const index = "2288363171";
        const pubKeyScript =
            "8SsHPc0wCbrItrmmFOsebOtGwd8YOSDTFyaGT7UZHRVGCtEjv0_N17kNJ5RqF8nxzbddbqELUOjxZe3n_llGksd7sEMbQg";
        const value = "503863382662879832";
        const payload = "I_9MVtYiO4NlH7lwIx8";
        const phash = "ibSvPHswcsI3o3nkQRpHp23ANg3tf9L5ivk5kKwnGTQ";
        const to = "򝊞􋄛𧚞󥫨򨚘󳽈򤙳񙓻򳳱􎖫򗣌𻄭񑦁򏬰񆆅򒒛􊗓𧜿򇞣􁓹";
        const token = "";

        const result = unmarshalPackValue(mintParamsType, {
            ghash,
            gpubkey,
            nhash,
            nonce,
            output: {
                outpoint: {
                    hash,
                    index,
                },
                pubKeyScript,
                value,
            },
            payload,
            phash,
            to,
            token,
        });
        expect(result).toEqual({
            ghash: Buffer.from(ghash, "base64"),
            gpubkey: Buffer.from(gpubkey, "base64"),
            nhash: Buffer.from(nhash, "base64"),
            nonce: Buffer.from(nonce, "base64"),
            output: {
                outpoint: {
                    hash: Buffer.from(hash, "base64"),
                    index: new BigNumber(index),
                },
                pubKeyScript: Buffer.from(pubKeyScript, "base64"),
                value: new BigNumber(value),
            },
            payload: Buffer.from(payload, "base64"),
            phash: Buffer.from(phash, "base64"),
            to: Buffer.from(to),
            token: Buffer.from(token),
        });
    });
});
