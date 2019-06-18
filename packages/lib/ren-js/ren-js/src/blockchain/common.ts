import { Networks as BNetworks, Opcode as BOpcode, Script as bScript } from "bitcore-lib";
import { Networks as ZNetworks, Opcode as ZOpcode, Script as zScript } from "bitcore-lib-zcash";
import { keccak256 } from "web3-utils";

export const strip0x = (hex: string) => hex.substring(0, 2) === "0x" ? hex.slice(2) : hex;
export const evenHex = (hex: string) => hex.length % 2 ? `0${hex}` : hex;

const hashPayload = (mintToAddress: string, commitmentHash: string) =>
    Buffer.from(strip0x(keccak256(`0x${strip0x(mintToAddress)}${strip0x(commitmentHash)}`)), "hex");

export const createAddress =
    (networks: typeof BNetworks | typeof ZNetworks, opcode: typeof BOpcode | typeof ZOpcode, script: typeof bScript | typeof zScript) =>
        ({ mainnet, masterPKH }: { mainnet: boolean, masterPKH: Buffer }) =>
            (mintToAddress: string, commitmentHash: string) =>
                new script()
                    .add(hashPayload(mintToAddress, commitmentHash))
                    // .add(mintToAddress) // Is this meant to be here?
                    .add(opcode.OP_DROP)
                    .add(opcode.OP_DUP)
                    .add(opcode.OP_HASH160)
                    .add(masterPKH)
                    .add(opcode.OP_EQUALVERIFY)
                    .add(opcode.OP_CHECKSIG)
                    .toScriptHashOut().toAddress(mainnet ? networks.livenet : networks.testnet).toString();
