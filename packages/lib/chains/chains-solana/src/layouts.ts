import {
    struct,
    bool,
    publicKey,
    u64,
    vec,
    array,
    u8,
    Layout,
} from "@project-serum/borsh";

import { PublicKey } from "@solana/web3.js";

export interface BurnLog {
    amount: any; // should be BN, but its type is private
    recipient_len: Number;
    recipient: Uint8Array;
}

export const BurnLogLayout: Layout<BurnLog> = struct([
    u64("amount"),
    u8("recipient_len"),
    array(u8(), 32, "recipient"),
]);

interface MintLog {
    is_initialized: boolean;
}

export const MintLogLayout: Layout<MintLog> = struct([bool("is_initialized")]);

export interface RenVmMsg {
    p_hash: Uint8Array;
    amount: any; // Should be BN, but its type is private :$
    s_hash: Uint8Array;
    to: Uint8Array;
    n_hash: Uint8Array;
}

export const RenVmMsgLayout: Layout<RenVmMsg> = struct([
    array(u8(), 32, "p_hash"),
    u64("amount"),
    array(u8(), 32, "s_hash"),
    array(u8(), 32, "to"),
    array(u8(), 32, "n_hash"),
]);

export interface Gateway {
    is_initialized: boolean;
    /// RenVM Authority is the Eth compatible address of RenVM's authority key. RenVM mint
    /// instructions require a ECDSA over Secp256k1 mint signature signed by the authority key.
    renvm_authority: Uint8Array;
    /// Keccak256 hash of the RenVM selector for the gateway's token
    selector_hash: Uint8Array;
    /// The number of burn operations that have happened so far. This is incremented whenever Ren
    /// tokens on Solana are burned.
    burn_count: any; // Should be BN, but type is private
}

export const GatewayLayout: Layout<Gateway> = struct([
    bool("is_initialized"),
    array(u8(), 20, "renvm_authority"),
    array(u8(), 32, "selectors"),
    u64("burn_count"),
]);
console.log("gatewaylayout", GatewayLayout);

export const GatewayRegistryLayout: Layout<GatewayRegistryState> = struct([
    bool("is_initialized"),
    publicKey("owner"),
    u64("count"),
    vec(array(u8(), 32), "selectors"),
    vec(publicKey(), "gateways"),
]);

export interface GatewayRegistryState {
    is_initialized: boolean;
    /// Owner is the pubkey that's allowed to write data to the registry state.
    owner: PublicKey;
    /// Number of selectors/gateway addresses stored in the registry.
    count: any; // Should be BN, but its type is private :$
    /// RenVM selector hashes.
    selectors: Uint8Array[];
    /// RenVM gateway program addresses.
    gateways: PublicKey[];
}
