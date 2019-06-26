import { Networks as BNetworks, Opcode as BOpcode, Script as bScript } from "bitcore-lib";
import { Networks as ZNetworks, Opcode as ZOpcode, Script as zScript } from "bitcore-lib-zcash";
import BN from "bn.js";

import { Network, NetworkMainnet } from "../networks";

// Remove 0x prefix from a hex string
export const strip0x = (hex: string) => hex.substring(0, 2) === "0x" ? hex.slice(2) : hex;

// Add a 0x prefix to a hex value, converting to a string first
export const Ox = (hex: string | BN | Buffer) => {
    const hexString = typeof hex === "string" ? hex : hex.toString("hex");
    return hexString.substring(0, 2) === "0x" ? hexString : `0x${hexString}`;
};

// Pad a hex string if necessary so that its length is even
export const evenHex = (hex: string) => hex.length % 2 ? `0${strip0x(hex)}` : hex;

export const createAddress =
    (networks: typeof BNetworks | typeof ZNetworks, opcode: typeof BOpcode | typeof ZOpcode, script: typeof bScript | typeof zScript) =>
        (network: Network, gHash: string) =>
            new script()
                .add(Buffer.from(strip0x(gHash), "hex"))
                // .add(mintToAddress) // Is this meant to be here?
                .add(opcode.OP_DROP)
                .add(opcode.OP_DUP)
                .add(opcode.OP_HASH160)
                .add(network.masterKey.mpkh)
                .add(opcode.OP_EQUALVERIFY)
                .add(opcode.OP_CHECKSIG)
                .toScriptHashOut().toAddress(network.name === NetworkMainnet.name ? networks.livenet : networks.testnet).toString();
            // TODO: Check: Is livenet = mainnet?
