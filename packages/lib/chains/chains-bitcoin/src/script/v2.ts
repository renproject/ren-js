import { sha256 } from "@renproject/utils/build/main/hash";
import base58 from "bs58";
import { Script } from "./script";

export const addressToScriptHash = (addressBuffer: Buffer) => {
    return sha256(
        new Script()
            .addOp(Script.OP.OP_DUP)
            .addOp(Script.OP.OP_HASH160)
            .addData(addressBuffer)
            .addOp(Script.OP.OP_EQUALVERIFY)
            .addOp(Script.OP.OP_CHECKSIG)
            .toBuffer(),
    );
};

const gatewayScript = (gGubKeyHash: Buffer, gHash: Buffer): Script =>
    new Script()
        .addData(gHash)
        .addOp(Script.OP.OP_DROP)
        .addOp(Script.OP.OP_DUP)
        .addOp(Script.OP.OP_HASH160)
        .addData(gGubKeyHash)
        .addOp(Script.OP.OP_EQUALVERIFY)
        .addOp(Script.OP.OP_CHECKSIG);

export const createAddress = (
    gGubKeyHash: Buffer,
    gHash: Buffer,
    prefix: Buffer,
): Buffer => gatewayScript(gGubKeyHash, gHash).toAddress(prefix);

export const pubKeyScript = (gGubKeyHash: Buffer, gHash: Buffer) =>
    gatewayScript(gGubKeyHash, gHash).toScriptHashOut();

export const pubKeyScriptHash = (gGubKeyHash: Buffer, gHash: Buffer): string =>
    sha256(pubKeyScript(gGubKeyHash, gHash)).reverse().toString("hex");
