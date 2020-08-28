import { RenVMType } from "@renproject/interfaces";
import BigNumber from "bignumber.js";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";

import RenJS from "../src";

chai.use(chaiBigNumber(BigNumber));
chai.should();

describe("RenVM", () => {
    it.skip("test", async () => {
        // You can remove this bit - just a shortcut so you can do
        // `arg("amount", "u64", 100)` instead of `{ name: "amount", type: "u64", value: 100 }`
        const arg = <Name extends string, Type extends string, ValueType>(
            name: Name,
            type: Type,
            value: ValueType
        ) => ({ name, type, value });
        const darknode = new RenJS("testnet").lightnode;
        // TODO: Fill out properly.
        await darknode.submitTx({
            to: RenJS.Tokens.BTC.Mint,
            in: [
                arg("p", RenVMType.ExtEthCompatPayload, {
                    abi: "",
                    value: "",
                    fn: "",
                }),
                // arg("amount", RenVMType.U64, 100),
                arg("token", RenVMType.ExtTypeEthCompatAddress, "base64 token"),
                arg("to", RenVMType.ExtTypeEthCompatAddress, "base64 to"),
                arg("n", RenVMType.B32, "base64 n"),
                arg("utxo", RenVMType.ExtTypeBtcCompatUTXO, {
                    txHash: "base64 txHash",
                    vOut: "0",
                }),
            ],
        });
    });
});
