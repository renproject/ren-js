import base58 from "bs58";
import * as Layout from "@solana/buffer-layout";
import tweetnacl from "tweetnacl";
import { Buffer } from "buffer";

import Wallet from "@project-serum/sol-wallet-adapter";
import {
    assert,
    ChainTransaction,
    InputChainTransaction,
    Logger,
    nullLogger,
    utils,
} from "@renproject/utils";
import {
    Connection,
    CreateSecp256k1InstructionWithEthAddressParams,
    PublicKey,
    Secp256k1Program,
    Transaction,
    TransactionInstruction,
    TransactionSignature,
} from "@solana/web3.js";

import {
    BurnLogLayout,
    GatewayRegistryLayout,
    GatewayRegistryState,
    GatewayRegistryStateKey,
    RenVmMsgLayout,
} from "./layouts";
import BigNumber from "bignumber.js";

const ETHEREUM_ADDRESS_BYTES = 20;
const SIGNATURE_OFFSETS_SERIALIZED_SIZE = 11;

const SECP256K1_INSTRUCTION_LAYOUT = Layout.struct<Layout.UInt>([
    Layout.u8("numSignatures"),
    Layout.u16("signatureOffset"),
    Layout.u8("signatureInstructionIndex"),
    Layout.u16("ethAddressOffset"),
    Layout.u8("ethAddressInstructionIndex"),
    Layout.u16("messageDataOffset"),
    Layout.u16("messageDataSize"),
    Layout.u8("messageInstructionIndex"),
    Layout.blob(21, "ethAddress"),
    Layout.blob(64, "signature"),
    Layout.u8("recoveryId"),
]);

/**
 * Create an secp256k1 instruction with an Ethereum address.
 *
 * We need to add an extra byte to the ethAddress to match our secp offset
 */
export const createInstructionWithEthAddress2 = (
    params: CreateSecp256k1InstructionWithEthAddressParams,
): TransactionInstruction => {
    const { ethAddress: rawAddress, message, signature, recoveryId } = params;
    let ethAddress;
    if (typeof rawAddress === "string") {
        if (rawAddress.startsWith("0x")) {
            ethAddress = utils.fromHex(rawAddress.substr(2));
        } else {
            ethAddress = utils.fromHex(rawAddress);
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
            signature: Buffer.from(signature),
            ethAddress: Buffer.from([0, ...ethAddress]),
            recoveryId,
        } as unknown as Layout.UInt,
        instructionData,
    );
    instructionData.fill(
        Buffer.from(message),
        SECP256K1_INSTRUCTION_LAYOUT.span,
    );
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
): Promise<void> => {
    // Wait up to 20 seconds for the transaction to be finalized.
    await Promise.race([
        connection.confirmTransaction(signature, "finalized"),
        20 * utils.sleep.SECONDS,
    ]);
};

export const constructRenVMMsg = (
    p_hash: Uint8Array,
    amount: string,
    token: Uint8Array,
    to: string,
    n_hash: Uint8Array,
    logger: Logger = nullLogger,
): Uint8Array[] => {
    try {
        const renvmmsg = Buffer.from(new Array(160));
        const preencode = {
            p_hash: new Uint8Array(p_hash),
            amount: new Uint8Array(utils.toNBytes(amount, 32)),
            token: new Uint8Array(token),
            to: new Uint8Array(base58.decode(to)),
            n_hash: new Uint8Array(n_hash),
        };

        logger.debug(
            "renvmmsg preencode",
            JSON.stringify({
                s_hash: token,
                p_hash,
                to: base58.decode(to),
                n_hash,
                amount: utils.toNBytes(amount, 32),
            }),
        );

        const renvmMsgSlice = utils.concat([
            preencode.p_hash,
            preencode.amount,
            preencode.token,
            preencode.to,
            preencode.n_hash,
        ]);
        RenVmMsgLayout.encode(preencode, renvmmsg);
        logger.debug("renvmmsg encoded", renvmmsg);
        return [new Uint8Array(renvmmsg), renvmMsgSlice];
    } catch (e) {
        logger.debug("failed to encoded renvmmsg", e);
        throw e;
    }
};

export const makeTestSigner = (privatekey: Uint8Array): Wallet => {
    const key = tweetnacl.sign.keyPair.fromSecretKey(privatekey);

    const pubk = new PublicKey(key.publicKey);
    return {
        publicKey: pubk,
        // eslint-disable-next-line @typescript-eslint/require-await
        signTransaction: async (x: Transaction): Promise<Transaction> => {
            const sig = tweetnacl.sign.detached(
                x.serializeMessage(),
                key.secretKey,
            );
            x.addSignature(pubk, Buffer.from(sig));
            return x;
        },
    } as Wallet;
};

export const getGatewayRegistryState = async (
    provider: Connection,
    gatewayRegistry: string,
): Promise<GatewayRegistryState> => {
    // Load registry state to find programs
    const gatewayRegistryPublicKey = new PublicKey(gatewayRegistry);
    const stateKey = await PublicKey.findProgramAddress(
        [utils.fromUTF8String(GatewayRegistryStateKey)],
        gatewayRegistryPublicKey,
    );

    const gatewayData = await provider.getAccountInfo(stateKey[0]);

    if (!gatewayData) {
        throw new Error("Failed to load program state");
    }

    // Persist registry data
    return GatewayRegistryLayout.decode(gatewayData.data);
};

export const resolveTokenGatewayContract = (
    gatewayRegistryState: GatewayRegistryState,
    asset: string,
): PublicKey | undefined => {
    const sHash = new Uint8Array(
        utils.keccak256(utils.fromUTF8String(`${asset}/toSolana`)),
    );
    for (let i = 0; i < gatewayRegistryState.selectors.length; i++) {
        if (gatewayRegistryState.selectors[i].toString() === sHash.toString()) {
            return gatewayRegistryState.gateways[i];
        }
    }
    return undefined;
};

export const txHashToChainTransaction = (
    chain: string,
    txHash: string,
): ChainTransaction => ({
    chain: chain,
    txidFormatted: txHash,
    txid: txidFormattedToTxid(txHash),
    txindex: "0",
});

/**
 * Fetch the submission details of a previous burn from a burn nonce.
 */
export const getBurnFromNonce = async (
    provider: Connection,
    chain: string,
    asset: string,
    mintGateway: PublicKey,
    burnNonce: Uint8Array | number | string,
): Promise<InputChainTransaction | undefined> => {
    let leNonce: Uint8Array;
    if (typeof burnNonce == "number") {
        leNonce = utils.toNBytes(burnNonce, 8, "le");
    } else if (typeof burnNonce == "string") {
        leNonce = utils.toNBytes(new BigNumber(burnNonce), 8, "le");
    } else {
        leNonce = burnNonce;
    }

    const burnId = await PublicKey.findProgramAddress([leNonce], mintGateway);

    const burnInfo = await provider.getAccountInfo(burnId[0]);
    if (!burnInfo) {
        return undefined;
    }

    const burnData = BurnLogLayout.decode(burnInfo.data);
    const transactions = await provider.getConfirmedSignaturesForAddress2(
        burnId[0],
    );

    // Concatenate four u64s into a u256 value.
    const burnAmount = utils.fromBytes(
        utils.concat([
            utils.toNBytes(burnData.amount_section_1.toString(), 8, "le"),
            utils.toNBytes(burnData.amount_section_2.toString(), 8, "le"),
            utils.toNBytes(burnData.amount_section_3.toString(), 8, "le"),
            utils.toNBytes(burnData.amount_section_4.toString(), 8, "le"),
        ]),
    );

    // Convert borsh `Number` to built-in number
    const recipientLength = parseInt(burnData.recipient_len.toString());

    const txidFormatted = transactions[0].signature;
    const txid = utils.toURLBase64(
        new Uint8Array(base58.decode(txidFormatted)),
    );
    return {
        // Tx Details
        chain: chain,
        txid,
        txindex: "0",
        txidFormatted,
        // Input details
        asset,
        amount: burnAmount.toFixed(),
        nonce: utils.fromBytes(leNonce, "le").toFixed(),
        toRecipient: base58.encode(
            burnData.recipient.slice(0, recipientLength),
        ),
    };
};

/**
 * Convert a Solana transaction hash from its standard format to the format
 * required by RenVM.
 *
 * @param txidFormatted A Solana transaction hash formatted as a base58 string.
 * @returns The same Solana transaction hash formatted as a base64 string.
 */
export function txidFormattedToTxid(txidFormatted: string): string {
    return utils.toURLBase64(new Uint8Array(base58.decode(txidFormatted)));
}

/**
 * Convert a Solana transaction hash from the format required by RenVM to its
 * standard format.
 *
 * @param txid A Solana transaction hash formatted as a base64 string.
 * @returns The same Solana transaction hash formatted as a base58 string.
 */
export function txidToTxidFormatted(txid: string): string {
    return base58.encode(utils.fromBase64(txid));
}
