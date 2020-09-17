import { Script } from "./script";

const gatewayScript = (gPubKey: Buffer, gHash: Buffer): Script =>
    new Script()
        .addData(gHash)
        .addOp(Script.OP.OP_DROP)
        .addOp(Script.OP.OP_DUP)
        .addOp(Script.OP.OP_HASH160)
        .addData(gPubKey)
        .addOp(Script.OP.OP_EQUALVERIFY)
        .addOp(Script.OP.OP_CHECKSIG);

export const createAddress = (
    gPubKey: Buffer,
    gHash: Buffer,
    prefix: Buffer
): Buffer => gatewayScript(gPubKey, gHash).toAddress(prefix);

export const pubKeyScript = (gPubKey: Buffer, gHash: Buffer) =>
    gatewayScript(gPubKey, gHash).toScriptHashOut();
