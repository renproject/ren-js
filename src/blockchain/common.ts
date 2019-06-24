import { Networks as BNetworks, Opcode as BOpcode, Script as bScript } from "bitcore-lib";
import { Networks as ZNetworks, Opcode as ZOpcode, Script as zScript } from "bitcore-lib-zcash";

// Remove 0x prefix from a hex string
export const strip0x = (hex: string) => hex.substring(0, 2) === "0x" ? hex.slice(2) : hex;

// Add a 0x prefix from a hex string
export const Ox = (hex: string) => hex.substring(0, 2) === "0x" ? hex : `0x${hex}`;

// Pad a hex string if necessary so that its length is even
export const evenHex = (hex: string) => hex.length % 2 ? `0${strip0x(hex)}` : hex;

export const createAddress =
    (networks: typeof BNetworks | typeof ZNetworks, opcode: typeof BOpcode | typeof ZOpcode, script: typeof bScript | typeof zScript) =>
        ({ mainnet, masterPKH }: { mainnet: boolean, masterPKH: Buffer }) =>
            (gHash: string) =>
                new script()
                    .add(Buffer.from(strip0x(gHash), "hex"))
                    // .add(mintToAddress) // Is this meant to be here?
                    .add(opcode.OP_DROP)
                    .add(opcode.OP_DUP)
                    .add(opcode.OP_HASH160)
                    .add(masterPKH)
                    .add(opcode.OP_EQUALVERIFY)
                    .add(opcode.OP_CHECKSIG)
                    .toScriptHashOut().toAddress(mainnet ? networks.livenet : networks.testnet).toString();
                // TODO: Check: Is livenet = mainnet?
