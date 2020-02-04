const RenJS = require("@renproject/ren").default;

(async () => {
    // You can remove this bit - just a shortcut so you can do
    // `arg("amount", "u64", 100)` instead of `{ name: "amount", type: "u64", value: 100 }`
    const arg = <Name extends string, Type extends string, ValueType>(name: Name, type: Type, value: ValueType) => ({ name, type, value }); const darknode = new RenJS.Darknode("127.0.0.1:6001");
    await darknode.submitTx({
        to: RenJS.Tokens.BTC.Mint,
        args: [
            arg("phash", "b32", "TODO - base64 phash"),
            arg("amount", "u64", 100 /* TODO */),
            arg("token", "b20", "TODO - base64 token"),
            arg("to", "b20", "TODO - base64 to"),
            arg("n", "b32", "TODO - base64 n"),
            arg("utxo", "ext_btcCompatUTXO", { "txHash": "TODO: base64 txHash", "vOut": 0 /* TODO */ }),
        ],
    });
})();
