import { strip0x } from "@renproject/ren-js-common";
import { Networks as BNetworks, Opcode as BOpcode, Script as bScript } from "bitcore-lib";

import { NetworkDetails } from "../types/networks";

export const createAddress =
    (networks: typeof BNetworks, opcode: typeof BOpcode, script: typeof bScript) =>
        (network: NetworkDetails, gHash: string) => {
            return new script()
                .add(Buffer.from(strip0x(gHash), "hex"))
                // .add(mintToAddress) // Is this meant to be here?
                .add(opcode.OP_DROP)
                .add(opcode.OP_DUP)
                .add(opcode.OP_HASH160)
                .add(Buffer.from(strip0x(network.contracts.renVM.mpkh), "hex"))
                .add(opcode.OP_EQUALVERIFY)
                .add(opcode.OP_CHECKSIG)
                .toScriptHashOut().toAddress(network.isTestnet ? networks.testnet : networks.mainnet).toString();
        };
