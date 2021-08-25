import { assert, SECONDS } from "@renproject/utils";
import {
    Connection,
    CreateSecp256k1InstructionWithEthAddressParams,
    Secp256k1Program,
    TransactionInstruction,
    TransactionSignature,
} from "@solana/web3.js";
import * as BufferLayout from "buffer-layout";

const ETHEREUM_ADDRESS_BYTES = 20;
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

export const toBuffer = (arr: Buffer | Uint8Array | number[]): Buffer => {
    if (arr instanceof Buffer) {
        return arr;
    } else if (arr instanceof Uint8Array) {
        return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    } else {
        return Buffer.from(arr);
    }
};
/**
 * Create an secp256k1 instruction with an Ethereum address.
 *
 * We need to add an extra byte to the ethAddress to match our secp offset
 * */
export const createInstructionWithEthAddress2 = (
    params: CreateSecp256k1InstructionWithEthAddressParams,
): TransactionInstruction => {
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
    const ethAddressLength: number = ethAddress.length;
    assert(
        ethAddress.length === ETHEREUM_ADDRESS_BYTES,
        `Address must be ${ETHEREUM_ADDRESS_BYTES} bytes but received ${ethAddressLength} bytes`,
    );
    const dataStart = 1 + SIGNATURE_OFFSETS_SERIALIZED_SIZE;
    const ethAddressOffset = dataStart + 1;
    const signatureOffset = ethAddressOffset + ethAddressLength;
    const messageDataOffset = signatureOffset + signature.length + 1;
    const numSignatures = 1;
    const instructionData = Buffer.alloc(
        Number(SECP256K1_INSTRUCTION_LAYOUT.span) + message.length,
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
    instructionData.fill(toBuffer(message), SECP256K1_INSTRUCTION_LAYOUT.span);
    return new TransactionInstruction({
        keys: [],
        programId: Secp256k1Program.programId,
        data: instructionData,
    });
};

/**
 * Wait for a transaction to be confirmed, and then wait up to 20 seconds for it
 * to be finalized. Some wallets don't seem to return if you wait for a
 * transaction to be finalized, so we return after 20 seconds.
 */
export const finalizeTransaction = async (
    connection: Connection,
    signature: TransactionSignature,
) => {
    // Wait up to 20 seconds for the transaction to be finalized.
    await Promise.race([
        connection.confirmTransaction(signature, "finalized"),
        20 * SECONDS,
    ]);
};
