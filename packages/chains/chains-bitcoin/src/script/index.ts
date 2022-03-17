import { Script } from "./script";

const gatewayScript = (gGubKeyHash: Uint8Array, gHash: Uint8Array): Script =>
    new Script()
        .addData(gHash)
        .addOp(Script.OP.OP_DROP)
        .addOp(Script.OP.OP_DUP)
        .addOp(Script.OP.OP_HASH160)
        .addData(gGubKeyHash)
        .addOp(Script.OP.OP_EQUALVERIFY)
        .addOp(Script.OP.OP_CHECKSIG);

export const createAddressArray = (
    gGubKeyHash: Uint8Array,
    gHash: Uint8Array,
    prefix: Uint8Array,
): Uint8Array => gatewayScript(gGubKeyHash, gHash).toAddress(prefix);

export const calculatePubKeyScript = (
    gGubKeyHash: Uint8Array,
    gHash: Uint8Array,
): Uint8Array => gatewayScript(gGubKeyHash, gHash).toScriptHashOut();
