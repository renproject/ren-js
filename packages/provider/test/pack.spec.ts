import { utils } from "@renproject/utils";
import BigNumber from "bignumber.js";
import { expect } from "chai";
import { describe, it } from "mocha";

import { unmarshalPackValue } from "../../utils/src/libraries/pack/unmarshal";
import { burnParamsType, crossChainParamsType } from "../src";

describe("Pack", () => {
    it("Unmarshal burn - 1", () => {
        const amount =
            "51423850459342719531259112406474019285406140697150570331000675381551947991775";
        const nonce = "H8AmOgjiSt8ULnuw1mDzPMJogHDOS2J1uNELrDma0xg";
        const to = "1234";

        const result = unmarshalPackValue(burnParamsType, {
            amount,
            nonce,
            to,
        });

        expect(result).to.deep.equal({
            amount: new BigNumber(amount),
            nonce: utils.fromBase64(nonce),
            to,
        });
    });

    it("Unmarshal mint", () => {
        const ghash = "x0gTBzbXmM1Xdwk-B8PHJ4sgY2T_NcrWsxK6MJ2xYos";
        const gpubkey = "8Qnq";
        const nhash = "a_46LkThVhVYlkIxBXaInubuEmYcfDNk45EBl60prhA";
        const nonce = "vPIiF6apzdJ4Rr8IMpT2uywo8LbuHOcaEXQ21ydXFBA";
        const txid = "_yJG1tKIALMrvaSes9BB4dYx5eCN8OK5V_PEM4N3R10";
        const txindex = "2288363171";
        const amount = "503863382662879832";
        const payload = "I_9MVtYiO4NlH7lwIx8";
        const phash = "ibSvPHswcsI3o3nkQRpHp23ANg3tf9L5ivk5kKwnGTQ";
        const to = "1234";

        const result = unmarshalPackValue(crossChainParamsType, {
            ghash,
            gpubkey,
            nhash,
            nonce,
            txid,
            txindex,
            amount,
            payload,
            phash,
            to,
        });

        expect(result).to.deep.equal({
            ghash: utils.fromBase64(ghash),
            gpubkey: utils.fromBase64(gpubkey),
            nhash: utils.fromBase64(nhash),
            nonce: utils.fromBase64(nonce),
            txid: utils.fromBase64(txid),
            txindex: new BigNumber(txindex),
            amount: new BigNumber(amount),
            payload: utils.fromBase64(payload),
            phash: utils.fromBase64(phash),
            to: to,
        });
    });
});
