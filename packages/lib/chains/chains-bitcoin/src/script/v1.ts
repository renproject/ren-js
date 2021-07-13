import {
    Networks as BNetworks,
    Opcode as BOpcode,
    Script as bScript,
} from "bitcore-lib";

const UTXOGatewayScript = (
    opcode: typeof BOpcode,
    script: typeof bScript,
    gPubKeyHash: Buffer,
    gHash: Buffer,
) =>
    new script()
        .add(gHash)
        .add(opcode.OP_DROP)
        .add(opcode.OP_DUP)
        .add(opcode.OP_HASH160)
        .add(gPubKeyHash)
        .add(opcode.OP_EQUALVERIFY)
        .add(opcode.OP_CHECKSIG)
        .toScriptHashOut();

export const createAddress =
    (
        networks: typeof BNetworks,
        opcode: typeof BOpcode,
        script: typeof bScript,
    ) =>
    (isTestnet: boolean, gPubKeyHash: Buffer, gHash: Buffer): string =>
        UTXOGatewayScript(opcode, script, gPubKeyHash, gHash)
            .toAddress(isTestnet ? networks.testnet : networks.mainnet)
            .toString();

export const pubKeyScript =
    (
        _networks: typeof BNetworks,
        opcode: typeof BOpcode,
        script: typeof bScript,
    ) =>
    (_isTestnet: boolean, gPubKeyHash: Buffer, gHash: Buffer) =>
        UTXOGatewayScript(opcode, script, gPubKeyHash, gHash).toBuffer();
