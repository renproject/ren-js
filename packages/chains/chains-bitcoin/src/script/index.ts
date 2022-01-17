import { Script } from "./script";

const gatewayScript = (gGubKeyHash: Buffer, gHash: Buffer): Script =>
    new Script()
        .addData(gHash)
        .addOp(Script.OP.OP_DROP)
        .addOp(Script.OP.OP_DUP)
        .addOp(Script.OP.OP_HASH160)
        .addData(gGubKeyHash)
        .addOp(Script.OP.OP_EQUALVERIFY)
        .addOp(Script.OP.OP_CHECKSIG);

export const createAddressBuffer = (
    gGubKeyHash: Buffer,
    gHash: Buffer,
    prefix: Buffer,
): Buffer => gatewayScript(gGubKeyHash, gHash).toAddress(prefix);

export const calculatePubKeyScript = (
    gGubKeyHash: Buffer,
    gHash: Buffer,
): Buffer => gatewayScript(gGubKeyHash, gHash).toScriptHashOut();
