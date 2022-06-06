import {
    array,
    bool,
    Layout,
    publicKey,
    struct,
    u64,
    u8,
    vec,
} from "@project-serum/borsh";
import { PublicKey } from "@solana/web3.js";

type BN = { toString(): string };

export interface BurnLog {
    // amount gets decoded into four u64s. Each u64 is little-endian, but
    // section_1 is the most significant section.
    amount_section_1: BN;
    amount_section_2: BN;
    amount_section_3: BN;
    amount_section_4: BN;

    recipient_len: Number;
    recipient: Uint8Array;
}

export const BurnLogLayoutV0: Layout<BurnLog> = struct([
    // amount's type is `spl_math::uint::U256`, which borsh doesn't support.
    u64("amount_section_1"),
    u64("amount_section_2"),
    u64("amount_section_3"),
    u64("amount_section_4"),

    u8("recipient_len"),
    array(u8(), 32, "recipient"),
]);

export const BurnLogLayout: Layout<BurnLog> = struct([
    // amount's type is `spl_math::uint::U256`, which borsh doesn't support.
    u64("amount_section_1"),
    u64("amount_section_2"),
    u64("amount_section_3"),
    u64("amount_section_4"),

    u8("recipient_len"),
    array(u8(), 64, "recipient"),
]);

interface MintLog {
    is_initialized: boolean;
}

export const MintLogLayout: Layout<MintLog> = struct([bool("is_initialized")]);

export interface RenVmMsg {
    p_hash: Uint8Array;
    amount: Uint8Array; // Should be BN, but its type is private :$
    token: Uint8Array;
    to: Uint8Array;
    n_hash: Uint8Array;
}

export const RenVMMessageLayout: Layout<RenVmMsg> = struct([
    array(u8(), 32, "p_hash"),
    array(u8(), 32, "amount"),
    array(u8(), 32, "token"),
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
    burn_count: BN;
    /// The number of decimals in the underlying asset.
    underlying_decimals: BN;
}

export const GatewayLayout: Layout<Gateway> = struct([
    bool("is_initialized"),
    array(u8(), 20, "renvm_authority"),
    array(u8(), 32, "selectors"),
    u64("burn_count"),
    u8("underlying_decimals"),
]);

export const GatewayStateKey = "GatewayStateV0.1.4";

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
    count: BN;
    /// RenVM selector hashes.
    selectors: Uint8Array[];
    /// RenVM gateway program addresses.
    gateways: PublicKey[];
}

export const GatewayRegistryStateKey = "GatewayRegistryState";
