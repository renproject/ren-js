import { Ox } from "@renproject/utils";
import {
    Networks as BNetworks,
    Opcode as BOpcode,
    Script as bScript,
} from "bitcore-lib";

import * as v1 from "./v1";
import * as v2 from "./v2";

/**
 * @dev Runs [[v1.createAddress]] and [[v2.createAddress]] side-by-side to make
 * sure that the v2 implementation is correct for all cases.
 * Eventually, v1 will be removed.
 */
export const createAddress = (
    networks: typeof BNetworks,
    opcode: typeof BOpcode,
    script: typeof bScript,
    addressToString: (bytes: Buffer) => string
) => (
    isTestnet: boolean,
    gGubKeyHash: Buffer,
    gHash: Buffer,
    prefix: Buffer
): string => {
    const v1Address = v1.createAddress(networks, opcode, script)(
        isTestnet,
        gGubKeyHash,
        gHash
    );

    const v2Address = addressToString(
        v2.createAddress(gGubKeyHash, gHash, prefix)
    );

    if (v1Address !== v2Address) {
        throw new Error(
            `Error: Different results returned from gateway address generation with parameters: \
isTestnet: ${isTestnet}, \
gPubKey: ${Ox(gGubKeyHash)}, \
gHash: ${Ox(gHash)}, \
prefix: ${Ox(prefix)}`
        );
    }

    return v1Address;
};

/**
 * @dev See [[createAddress]] comment.
 */
export const pubKeyScript = (
    networks: typeof BNetworks,
    opcode: typeof BOpcode,
    script: typeof bScript
) => (isTestnet: boolean, gPubKey: Buffer, gHash: Buffer) => {
    const v1PubKeyScript: Buffer = v1.pubKeyScript(networks, opcode, script)(
        isTestnet,
        gPubKey,
        gHash
    );

    const v2PubKeyScript = v2.pubKeyScript(gPubKey, gHash);

    if (!v1PubKeyScript.equals(v2PubKeyScript)) {
        throw new Error(
            `Error: Different results returned from gateway public key generation with parameters: \
isTestnet: ${isTestnet}, \
gPubKey: ${Ox(gPubKey)}, \
gHash: ${Ox(gHash)}`
        );
    }

    return v1PubKeyScript;
};
