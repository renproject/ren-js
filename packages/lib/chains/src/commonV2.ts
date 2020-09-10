export const V2 = undefined;

// import {
//     Networks as BNetworks,
//     Opcode as BOpcode,
//     Script as bScript,
// } from "bitcore-lib";

// export const UTXOGatewayScript = (
//     networks: typeof BNetworks,
//     opcode: typeof BOpcode,
//     script: typeof bScript,
//     isTestnet: boolean,
//     gPubKey: string,
//     gHash: string
// ) => {
//     return new script()
//         .add(fromHex(gHash)
//         .add(opcode.OP_DROP)
//         .add(opcode.OP_DUP)
//         .add(opcode.OP_HASH160)
//         .add(fromHex(gPubKey)
//         .add(opcode.OP_EQUALVERIFY)
//         .add(opcode.OP_CHECKSIG)
//         .toScriptHashOut()
//         .toAddress(isTestnet ? networks.testnet : networks.mainnet);
// };

// export const createAddress = (
//     networks: typeof BNetworks,
//     opcode: typeof BOpcode,
//     script: typeof bScript
// ) => (isTestnet: boolean, gPubKey: string, gHash: string): string => {
//     return UTXOGatewayScript(
//         networks,
//         opcode,
//         script,
//         isTestnet,
//         gPubKey,
//         gHash
//     ).toString();
// };

// export const UTXOGatewayPubKeyScript = (
//     networks: typeof BNetworks,
//     opcode: typeof BOpcode,
//     script: typeof bScript,
//     isTestnet: boolean,
//     gPubKey: string,
//     gHash: string
// ) => {
//     const gatewayScript = UTXOGatewayScript(
//         networks,
//         opcode,
//         script,
//         isTestnet,
//         gPubKey,
//         gHash
//     )
//         .toBuffer()
//         // Remove prefix
//         .slice(1);

//     const buffer = new script()
//         .add(opcode.OP_HASH160)
//         .add(gatewayScript)
//         .add(opcode.OP_EQUAL)
//         .toScriptHashOut()
//         .toBuffer();

//     // FIXME: The gatewayScript bytes don't seem to get set correctly.
//     const offset = 2;
//     for (let i = 0; i < gatewayScript.length; i++) {
//         buffer[i + offset] = gatewayScript[i];
//     }

//     return buffer;
// };

// export const pubKeyScript = (
//     networks: typeof BNetworks,
//     opcode: typeof BOpcode,
//     script: typeof bScript
// ) => (isTestnet: boolean, gPubKey: string, gHash: string) => {
//     return UTXOGatewayPubKeyScript(
//         networks,
//         opcode,
//         script,
//         isTestnet,
//         gPubKey,
//         gHash
//     );
// };
