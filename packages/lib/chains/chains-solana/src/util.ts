import { assert } from "@renproject/utils";
import {
    CreateSecp256k1InstructionWithEthAddressParams,
    Secp256k1Program,
    TransactionInstruction,
} from "@solana/web3.js";
import * as BufferLayout from "buffer-layout";

const PRIVATE_KEY_BYTES = 32;
const ETHEREUM_ADDRESS_BYTES = 20;
const PUBLIC_KEY_BYTES = 64;
const SIGNATURE_OFFSETS_SERIALIZED_SIZE = 11;

const SECP256K1_INSTRUCTION_LAYOUT = BufferLayout.struct([
    BufferLayout.u8("numSignatures"),
    BufferLayout.u16("signatureOffset"),
    BufferLayout.u8("signatureInstructionIndex"),
    BufferLayout.u16("ethAddressOffset"),
    BufferLayout.u8("ethAddressInstructionIndex"),
    BufferLayout.u16("messageDataOffset"),
    BufferLayout.u16("messageDataSize"),
    BufferLayout.u8("messageInstructionIndex"),
    BufferLayout.blob(21, "ethAddress"),
    BufferLayout.blob(64, "signature"),
    BufferLayout.u8("recoveryId"),
]);

export const toBuffer = (arr: Buffer | Uint8Array | Array<number>): Buffer => {
    if (arr instanceof Buffer) {
        return arr;
    } else if (arr instanceof Uint8Array) {
        return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    } else {
        return Buffer.from(arr);
    }
};
/**
 * Create an secp256k1 instruction with an Ethereum address. The address
 * must be a hex string or a buffer that is 20 bytes long.
 */
export function createInstructionWithEthAddress(
    params: CreateSecp256k1InstructionWithEthAddressParams,
): TransactionInstruction {
    const { ethAddress: rawAddress, message, signature, recoveryId } = params;

    let ethAddress;
    if (typeof rawAddress === "string") {
        if (rawAddress.startsWith("0x")) {
            ethAddress = Buffer.from(rawAddress.substr(2), "hex");
        } else {
            ethAddress = Buffer.from(rawAddress, "hex");
        }
    } else {
        ethAddress = rawAddress;
    }

    assert(
        ethAddress.length === ETHEREUM_ADDRESS_BYTES,
        `Address must be ${ETHEREUM_ADDRESS_BYTES} bytes but received ${ethAddress.length} bytes`,
    );

    const dataStart = 1 + SIGNATURE_OFFSETS_SERIALIZED_SIZE;
    const ethAddressOffset = dataStart;
    const signatureOffset = dataStart + ethAddress.length;
    const messageDataOffset = signatureOffset + signature.length + 1;
    const numSignatures = 1;

    const instructionData = Buffer.alloc(
        SECP256K1_INSTRUCTION_LAYOUT.span + message.length,
    );

    SECP256K1_INSTRUCTION_LAYOUT.encode(
        {
            numSignatures,
            signatureOffset,
            signatureInstructionIndex: 0,
            ethAddressOffset,
            ethAddressInstructionIndex: 0,
            messageDataOffset,
            messageDataSize: message.length,
            messageInstructionIndex: 0,
            signature: toBuffer(signature),
            ethAddress: [0, ...toBuffer(ethAddress)],
            recoveryId,
        },
        instructionData,
    );

    instructionData.fill(toBuffer(message), SECP256K1_INSTRUCTION_LAYOUT.span);

    return new TransactionInstruction({
        keys: [],
        programId: Secp256k1Program.programId,
        data: instructionData,
    });
}
/**
 * Create an secp256k1 instruction with an Ethereum address. The address
 * must be a hex string or a buffer that is 20 bytes long.
 */
export function createInstructionWithEthAddress2(
    params: CreateSecp256k1InstructionWithEthAddressParams,
): TransactionInstruction {
    const { ethAddress: rawAddress, message, signature, recoveryId } = params;
    let ethAddress;
    if (typeof rawAddress === "string") {
        if (rawAddress.startsWith("0x")) {
            ethAddress = Buffer.from(rawAddress.substr(2), "hex");
        } else {
            ethAddress = Buffer.from(rawAddress, "hex");
        }
    } else {
        ethAddress = rawAddress;
    }
    assert(
        ethAddress.length === ETHEREUM_ADDRESS_BYTES,
        `Address must be ${ETHEREUM_ADDRESS_BYTES} bytes but received ${ethAddress.length} bytes`,
    );
    const dataStart = 1 + SIGNATURE_OFFSETS_SERIALIZED_SIZE;
    const ethAddressOffset = dataStart + 1;
    const signatureOffset = ethAddressOffset + ethAddress.length;
    const messageDataOffset = signatureOffset + signature.length + 1;
    const numSignatures = 1;
    const instructionData = Buffer.alloc(
        SECP256K1_INSTRUCTION_LAYOUT.span + 1 + message.length,
    );
    SECP256K1_INSTRUCTION_LAYOUT.encode(
        {
            numSignatures,
            signatureOffset,
            signatureInstructionIndex: 1,
            ethAddressOffset,
            ethAddressInstructionIndex: 1,
            messageDataOffset,
            messageDataSize: message.length,
            messageInstructionIndex: 1,
            signature: toBuffer(signature),
            ethAddress: toBuffer([0, ...ethAddress]),
            recoveryId,
        },
        instructionData,
    );
    // TODO: need to add `0` byte before `ethAddress` in the SECP256K1_INSTRUCTION_LAYOUT
    instructionData.fill(toBuffer(message), SECP256K1_INSTRUCTION_LAYOUT.span);
    return new TransactionInstruction({
        keys: [],
        programId: Secp256k1Program.programId,
        data: instructionData,
    });
}
