import {
    blob,
    Layout,
    offset,
    seq,
    struct,
    u16,
    u32,
    u8,
    UInt,
} from "@solana/buffer-layout";

// Note - `blob` layouts are used below for types which buffer-layout doesn't
// directly support. Previously @project-serum/borsh was used for more complex
// types but was removed to reduce dependencies.

export interface BurnLog {
    amount_section: Uint8Array;
    recipient_len: number;
    recipient: Uint8Array;
}

export const BurnLogLayoutV0: Layout<BurnLog> = struct([
    // uint256
    blob(32, "amount_section"),
    u8("recipient_len"),
    // 32-byte array
    blob(32, "recipient"),
]);

export const BurnLogLayout: Layout<BurnLog> = struct([
    // uint256
    blob(32, "amount_section"),
    u8("recipient_len"),
    // 64-length bytes
    blob(64, "recipient"),
]);

interface MintLog {
    is_initialized: number;
}

export const MintLogLayout: Layout<MintLog> = struct([u8("is_initialized")]);

export interface RenVmMsg {
    p_hash: Uint8Array;
    amount: Uint8Array; // Should be BN, but its type is private :$
    token: Uint8Array;
    to: Uint8Array;
    n_hash: Uint8Array;
}

export const RenVMMessageLayout: Layout<RenVmMsg> = struct([
    // 32-byte array
    blob(32, "p_hash"),
    // 32-byte array
    blob(32, "amount"),
    // 32-byte array
    blob(32, "token"),
    // 32-byte array
    blob(32, "to"),
    // 32-byte array
    blob(32, "n_hash"),
]);

export interface Gateway {
    is_initialized: number;
    /// RenVM Authority is the Eth compatible address of RenVM's authority key. RenVM mint
    /// instructions require a ECDSA over Secp256k1 mint signature signed by the authority key.
    renvm_authority: Uint8Array;
    /// Keccak256 hash of the RenVM selector for the gateway's token
    selector_hash: Uint8Array;
    /// The number of burn operations that have happened so far. This is incremented whenever Ren
    /// tokens on Solana are burned.
    burn_count: Uint8Array;
    /// The number of decimals in the underlying asset.
    underlying_decimals: number;
}

export const GatewayLayout: Layout<Gateway> = struct([
    // boolean
    u8("is_initialized"),
    // 20-byte array
    blob(20, "renvm_authority"),
    // 32-byte array
    blob(32, "selectors"),
    // uint64
    blob(8, "burn_count"),
    // uint8
    u8("underlying_decimals"),
]);

export const GatewayStateKey = "GatewayStateV0.1.4";

export interface GatewayRegistryState {
    is_initialized: number;
    /// Owner is the pubkey that's allowed to write data to the registry state.
    owner: Uint8Array;
    /// Number of selectors/gateway addresses stored in the registry.
    count: Uint8Array;
    /// RenVM selector hashes.
    selectors: {
        length: number;
        values: Uint8Array[];
    };
    /// RenVM gateway program addresses.
    gateways: {
        length: number;
        values: Uint8Array[];
    };
}

export const GatewayRegistryStateKey = "GatewayRegistryState";

const vec = <T>(type: Layout<T>, name: string) => {
    const length = u32("length");
    return struct<{
        length: number;
        values: T[];
    }>([length, seq(type, offset(length, -length.span), "values")], name);
};

export const GatewayRegistryLayout: Layout<GatewayRegistryState> = struct([
    // boolean
    u8("is_initialized"),
    // PublicKey
    blob(32, "owner"),
    // uint64
    blob(8, "count"),
    // array of 32-byte arrays
    vec(blob(32), "selectors"),
    // PublicKey array
    vec(blob(32), "gateways"),
]);

export const SECP256K1_INSTRUCTION_LAYOUT = struct<UInt>([
    u8("numSignatures"),
    u16("signatureOffset"),
    u8("signatureInstructionIndex"),
    u16("ethAddressOffset"),
    u8("ethAddressInstructionIndex"),
    u16("messageDataOffset"),
    u16("messageDataSize"),
    u8("messageInstructionIndex"),
    blob(21, "ethAddress"),
    blob(64, "signature"),
    u8("recoveryId"),
]);

// NOT USED BECAUSE TYPESCRIPT DOESN'T SUPPORT INHERITING FROM CLASSES BUILT
// USING A DIFFERENT TSC TARGET - RE-ENABLE IF FIXED.
// // Layout that converts the data to a BigNumber.
// class BigNumberLayout extends Layout<BigNumber> {
//     private blob: Blob;

//     public constructor(span: number, property?: string) {
//         super(span, property);
//         this.blob = blob(span);
//     }

//     public decode(b: Buffer, dataOffset = 0) {
//         return utils.fromBytes(this.blob.decode(b, dataOffset), "le");
//     }

//     public encode(src: BigNumber, b: Buffer, dataOffset = 0) {
//         return this.blob.encode(
//             utils.toNBytes(src, this.span, "le"),
//             b,
//             dataOffset,
//         );
//     }
// }

// const u64 = (property: string) => new BigNumberLayout(64 / 8, property);
// const u256 = (property: string) => new BigNumberLayout(64 / 8, property);
