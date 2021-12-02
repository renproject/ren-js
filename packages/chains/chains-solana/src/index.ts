import BigNumber from "bignumber.js";
import { BN } from "bn.js";
import base58 from "bs58";

import {
    createAssociatedTokenAccount,
    getAssociatedTokenAddress,
} from "@project-serum/associated-token";
import {
    BurnDetails,
    BurnPayloadConfig,
    ContractCall,
    doesntError,
    EventEmitterTyped,
    keccak256,
    LockAndMintTransaction,
    Logger,
    MintChain,
    nullLogger,
    OverwritableBurnAndReleaseParams,
    OverwritableLockAndMintParams,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
    SECONDS,
    tryNTimes,
} from "@renproject/utils";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
    ConfirmOptions,
    Connection,
    CreateSecp256k1InstructionWithEthAddressParams,
    PublicKey,
    sendAndConfirmRawTransaction,
    SystemProgram,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";

import {
    BurnLogLayout,
    GatewayLayout,
    GatewayRegistryLayout,
    GatewayRegistryState,
    GatewayRegistryStateKey,
    GatewayStateKey,
    MintLogLayout,
    RenVmMsgLayout,
} from "./layouts";
import { renMainnet, resolveNetwork, SolNetworkConfig } from "./networks";
import { createInstructionWithEthAddress2, finalizeTransaction } from "./util";

// FIXME: Typings are out of date, so lets fall back to good old any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ActualToken: any = Token;

export type SolTransaction = string;
export type SolAddress = string;

export interface SolanaProvider {
    connection: Connection;
    wallet: {
        publicKey: PublicKey;
        signTransaction: (transaction: Transaction) => Promise<Transaction>;
    };
}

interface SolOptions {
    logger?: Logger;
    includeAddressInPayload?: boolean;
}

export class Solana
    implements MintChain<SolTransaction, SolAddress, SolNetworkConfig>
{
    public static chain = "Solana" as const;
    public chain = Solana.chain;
    public name = Solana.chain;

    public renNetworkDetails: SolNetworkConfig;

    public _config: SolOptions & { logger: Logger };

    public burnPayloadConfig: BurnPayloadConfig = {
        bytes: false,
    };

    public provider: SolanaProvider;

    public constructor(
        provider: SolanaProvider,
        renNetwork?:
            | RenNetwork
            | RenNetworkString
            | RenNetworkDetails
            | SolNetworkConfig,
        config?: SolOptions,
    ) {
        this.provider = provider;
        if (!this.provider.connection) {
            throw new Error("No connection to provider");
        }
        this.initialize = this.initialize.bind(this);
        this.waitForInitialization = this.waitForInitialization.bind(this);
        // Default to mainnet if not specified
        if (renNetwork) {
            this.renNetworkDetails = resolveNetwork(renNetwork);
        } else {
            this.renNetworkDetails = renMainnet;
        }
        this._config = {
            ...config,
            logger: config?.logger || nullLogger,
        };
        this.initialize(this.renNetworkDetails.name).catch(console.error);
    }

    public static utils = {
        resolveChainNetwork: resolveNetwork,

        /**
         * A Solana address is a base58-encoded 32-byte ed25519 public key.
         */
        addressIsValid: doesntError(
            (address: SolAddress | string) =>
                base58.decode(address).length === 32,
        ),

        /**
         * A Solana transaction's ID is a base58-encoded 64-byte signature.
         */
        transactionIsValid: doesntError(
            (transaction: SolTransaction | string) =>
                base58.decode(transaction).length === 64,
        ),

        addressExplorerLink: (
            address: SolAddress,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | SolNetworkConfig,
        ): string => {
            const resolvedNetwork =
                Solana.utils.resolveChainNetwork(network) || renMainnet;

            return `${resolvedNetwork.chainExplorer}/address/${address}?cluster=${resolvedNetwork.chain}`;
        },

        transactionExplorerLink: (
            transaction: SolTransaction,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | SolNetworkConfig = renMainnet,
        ): string => {
            const resolvedNetwork =
                Solana.utils.resolveChainNetwork(network) || renMainnet;

            return `${resolvedNetwork.chainExplorer}/tx/${transaction}?cluster=${resolvedNetwork.chain}`;
        },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public utils = Solana.utils as any;

    /**
     * Should be set by `constructor` or `initialize`.
     */
    renNetwork?: RenNetworkDetails;

    gatewayRegistryData?: GatewayRegistryState;

    _initialized?: Promise<true>;
    /**
     * `initialize` allows RenJS to pass in parameters after the user has
     * initialized the Chain. This allows the user to pass in network
     * parameters such as the network only once.
     *
     * If the Chain's constructor has an optional network parameter and the
     * user has explicitly initialized it, the Chain should ignore the
     * network passed in to `initialize`. This is to allow different network
     * combinations, such as working with testnet Bitcoin and a local Ethereum
     * chain - whereas the default `testnet` configuration would use testnet
     * Bitcoin and Ethereum's Kovan testnet.
     */
    async initialize(
        network: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) {
        this.renNetwork = Solana.utils.resolveChainNetwork(network);

        // Load registry state to find programs
        const pubk = new PublicKey(
            this.renNetworkDetails.addresses.GatewayRegistry,
        );
        const stateKey = await PublicKey.findProgramAddress(
            [Buffer.from(GatewayRegistryStateKey)],
            pubk,
        );

        const gatewayData = await this.provider.connection.getAccountInfo(
            stateKey[0],
        );

        if (!gatewayData) {
            throw new Error("Failed to load program state");
        }
        // Persist registry data
        // TODO: Consider if we want to handle the edge case of programs being
        // updated during the lifecyle of the chain pbject
        this.gatewayRegistryData = GatewayRegistryLayout.decode(
            gatewayData.data,
        );

        return this;
    }

    async waitForInitialization() {
        if (this._initialized === undefined) {
            this._initialized = this.initialize(
                this.renNetworkDetails.name,
            ).then(() => true);
        }
        return this._initialized;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withProvider(provider: any) {
        this.provider = provider;
        return this;
    }

    public isLockAsset(asset: string) {
        return asset === "SOL";
    }

    /**
     * `assetIsSupported` should return true if the the asset is native to the
     * chain or if the asset can be minted onto the chain.
     *
     * ```ts
     * ethereum.assetIsSupported = asset => asset === "ETH" || asset === "BTC" || ...;
     * ```
     */
    assetIsSupported = async (asset: string) => {
        await this.waitForInitialization();
        if (this.isLockAsset(asset)) {
            return true;
        }

        const sHash = Uint8Array.from(
            keccak256(Buffer.from(`${asset}/toSolana`)),
        );
        if (
            this.gatewayRegistryData &&
            this.gatewayRegistryData.selectors.find(
                (x) => x.toString() === sHash.toString(),
            )
        ) {
            return true;
        }
        return false;
    };

    assetDecimals = async (asset: string) => {
        await this.waitForInitialization();
        const address = await this.getSPLTokenPubkey(asset);
        const res = await this.provider.connection.getTokenSupply(
            new PublicKey(address),
        );

        return res.value.decimals;
    };

    transactionID = (transaction: SolTransaction) => {
        if (this._config.logger) {
            this._config.logger.debug("tx", transaction);
        }
        // TODO: use the transaction signature for both?
        return transaction;
    };

    transactionConfidence = async (transaction: SolTransaction) => {
        await this.waitForInitialization();
        // NOTE: Solana has a built in submit and wait until target confirmations
        // function; so it might not make sense to use this?
        const tx = await this.provider.connection.getConfirmedTransaction(
            transaction,
        );

        const currentSlot = await this.provider.connection.getSlot();
        return {
            current: currentSlot - (tx && tx.slot ? tx.slot : 0),
            target: this.renNetworkDetails.isTestnet ? 1 : 2,
        };
    };

    transactionRPCFormat = (transaction: SolTransaction) => {
        this._config.logger.debug("tx", transaction);

        return {
            txid: base58.decode(transaction),
            txindex: "0",
        };
    };

    transactionRPCTxidFromID = (transactionID: string): Buffer =>
        base58.decode(transactionID);

    transactionIDFromRPCFormat = (txid: string | Buffer, txindex: string) =>
        this.transactionID(this.transactionFromRPCFormat(txid, txindex));

    transactionFromRPCFormat = (
        txid: string | Buffer,
        _txindex: string,
        _reversed?: boolean,
    ) => {
        if (typeof txid == "string") return txid;
        return base58.encode(txid);
    };
    /**
     * @deprecated Renamed to `transactionFromRPCFormat`.
     * Will be removed in 3.0.0.
     */
    transactionFromID = this.transactionFromRPCFormat;

    resolveTokenGatewayContract = (asset: string) => {
        if (!this.gatewayRegistryData) {
            throw new Error("chain not initialized");
        }

        const sHash = Uint8Array.from(
            keccak256(Buffer.from(`${asset}/toSolana`)),
        );
        let idx = -1;
        const contract =
            this.gatewayRegistryData &&
            this.gatewayRegistryData.selectors.find(
                (x, i) =>
                    x.toString() === sHash.toString() &&
                    (() => {
                        idx = i;
                        return true;
                    })(),
            );
        if (!contract) throw new Error("unsupported asset");
        return this.gatewayRegistryData.gateways[idx].toBase58();
    };

    async getSPLTokenPubkey(asset: string) {
        await this.waitForInitialization();
        const program = new PublicKey(this.resolveTokenGatewayContract(asset));
        const s_hash = keccak256(Buffer.from(`${asset}/toSolana`));

        const tokenMintId = await PublicKey.findProgramAddress(
            [s_hash],
            program,
        );
        return tokenMintId[0];
    }

    constructRenVMMsg = (
        p_hash: Buffer,
        amount: string,
        token: Buffer,
        to: string,
        n_hash: Buffer,
    ) => {
        try {
            const renvmmsg = Buffer.from(new Array(160));
            const preencode = {
                p_hash: new Uint8Array(p_hash),
                amount: new Uint8Array(
                    new BN(amount.toString()).toArray("be", 32),
                ),
                token: new Uint8Array(token),
                to: new Uint8Array(base58.decode(to)),
                n_hash: new Uint8Array(n_hash),
            };

            this._config.logger.debug(
                "renvmmsg preencode",
                JSON.stringify({
                    s_hash: token,
                    p_hash,
                    to: base58.decode(to),
                    n_hash,
                    amount: new Uint8Array(
                        new BN(amount.toString()).toArray("be", 32),
                    ),
                }),
            );

            const renvmMsgSlice = Buffer.from([
                ...preencode.p_hash,
                ...preencode.amount,
                ...preencode.token,
                ...preencode.to,
                ...preencode.n_hash,
            ]);
            RenVmMsgLayout.encode(preencode, renvmmsg);
            this._config.logger.debug("renvmmsg encoded", renvmmsg);
            return [renvmmsg, renvmMsgSlice];
        } catch (e) {
            this._config.logger.debug("failed to encoded renvmmsg", e);
            throw e;
        }
    };

    /**
     * `submitMint` should take the completed mint transaction from RenVM and
     * submit its signature to the mint chain to finalize the mint.
     */

    submitMint = async (
        asset: string,
        contractCalls: ContractCall[],
        mintTx: LockAndMintTransaction,
        eventEmitter: EventEmitterTyped<{
            transaction: [ChainTransaction];
            confirmation: [number, { status: number }];
        }>,
    ) => {
        await this.waitForInitialization();
        this._config.logger.debug("submitting mintTx:", mintTx);
        if (mintTx.out && mintTx.out.revert)
            throw new Error(
                `Transaction reverted: ${mintTx.out.revert.toString()}`,
            );
        if (!mintTx.out || !mintTx.out.signature)
            throw new Error("Missing signature");
        let sig = mintTx.out.signature;
        // FIXME: Not sure why this happens when retrieving the tx by polling for submission result
        if (typeof sig === "string") {
            sig = Buffer.from(sig, "hex");
        }

        const program = new PublicKey(this.resolveTokenGatewayContract(asset));

        const gatewayAccountId = await PublicKey.findProgramAddress(
            [new Uint8Array(Buffer.from(GatewayStateKey))],
            program,
        );
        const s_hash = keccak256(Buffer.from(`${asset}/toSolana`));

        const tokenMintId = await this.getSPLTokenPubkey(asset);

        const isSigner = false;
        const isWritable = false;

        const mintAuthorityId = await PublicKey.findProgramAddress(
            [tokenMintId.toBuffer()],
            program,
        );

        const recipientTokenAccount = new PublicKey(contractCalls[0].sendTo);

        // To get to this point, the token account should already exist.
        // const recipientWalletAddress =
        //     contractCalls[0] &&
        //     contractCalls[0].contractParams &&
        //     contractCalls[0].contractParams[0] &&
        //     contractCalls[0].contractParams[0].value;
        // await this.createAssociatedTokenAccount(asset, recipientWalletAddress);

        const [renvmmsg, renvmMsgSlice] = this.constructRenVMMsg(
            Buffer.from(mintTx.out.phash.toString("hex"), "hex"),
            mintTx.out.amount.toString(),
            Buffer.from(s_hash.toString("hex"), "hex"),
            recipientTokenAccount.toString(),
            Buffer.from(mintTx.out.nhash.toString("hex"), "hex"),
        );

        const mintLogAccountId = await PublicKey.findProgramAddress(
            [keccak256(renvmmsg)],
            program,
        );
        this._config.logger.debug(
            "mint log account",
            mintLogAccountId[0].toString(),
        );

        //TODO: we may want to just return this for custom integrations - users should be able to add this instruction to their application's instruction set for composition
        const instruction = new TransactionInstruction({
            keys: [
                {
                    pubkey: this.provider.wallet.publicKey,
                    isSigner: true,
                    isWritable,
                },
                { pubkey: gatewayAccountId[0], isSigner, isWritable },
                { pubkey: tokenMintId, isSigner, isWritable: true },
                {
                    pubkey: recipientTokenAccount,
                    isSigner,
                    isWritable: true,
                },
                {
                    pubkey: mintLogAccountId[0],
                    isSigner,
                    isWritable: true,
                },
                {
                    pubkey: mintAuthorityId[0],
                    isSigner,
                    isWritable,
                },
                {
                    pubkey: SystemProgram.programId,
                    isSigner,
                    isWritable,
                },
                {
                    pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,
                    isSigner,
                    isWritable,
                },
                {
                    pubkey: SYSVAR_RENT_PUBKEY,
                    isSigner,
                    isWritable,
                },
                {
                    pubkey: TOKEN_PROGRAM_ID,
                    isSigner,
                    isWritable,
                },
            ],
            programId: program,
            data: Buffer.from([1]),
        });
        this._config.logger.debug(
            "mint instruction",
            JSON.stringify(instruction),
        );

        // To get the current gateway pubkey
        const gatewayInfo = await this.provider.connection.getAccountInfo(
            gatewayAccountId[0],
        );

        if (!gatewayInfo) throw new Error("incorrect gateway program address");

        const gatewayState = GatewayLayout.decode(gatewayInfo.data);

        const tx = new Transaction();

        // The instruction to check the signature
        const secpParams: CreateSecp256k1InstructionWithEthAddressParams = {
            ethAddress: Buffer.from(gatewayState.renvm_authority),
            message: renvmMsgSlice,
            signature: sig.slice(0, 64),
            recoveryId: sig[64] - 27,
        };
        this._config.logger.debug(
            "authority address",
            secpParams.ethAddress.toString("hex"),
        );
        this._config.logger.debug("secp params", secpParams);

        const secPInstruction = createInstructionWithEthAddress2(secpParams);
        secPInstruction.data = Buffer.from([...secPInstruction.data]);

        tx.add(instruction, secPInstruction);

        tx.recentBlockhash = (
            await this.provider.connection.getRecentBlockhash("confirmed")
        ).blockhash;
        tx.feePayer = this.provider.wallet.publicKey;

        const simulationResult = await tryNTimes(
            async () => this.provider.connection.simulateTransaction(tx),
            5,
        );
        if (simulationResult.value.err) {
            throw new Error(
                "transaction simulation failed: " +
                    JSON.stringify(simulationResult),
            );
        }
        const signed = await this.provider.wallet.signTransaction(tx);

        const signature = signed.signature;
        if (!signature) throw new Error("failed to sign");

        // FIXME: this follows eth's events, generalize this
        eventEmitter.emit("transactionHash", base58.encode(signature));
        this._config.logger.debug("signed with signature", signature);

        // Should be the same as `signature`.
        const confirmedSignature = await sendAndConfirmRawTransaction(
            this.provider.connection,
            signed.serialize(),
            { commitment: "confirmed" },
        );

        // FIXME: this follows eth's events, generalize this
        eventEmitter.emit("confirmation", 1, { status: 1 });

        // Wait up to 20 seconds for the transaction to be finalized.
        await finalizeTransaction(this.provider.connection, confirmedSignature);

        this._config.logger.debug("sent and confirmed", confirmedSignature);

        return confirmedSignature;
    };

    findMintByDepositDetails = async (
        asset: string,
        sHash: Buffer,
        nHash: Buffer,
        pHash: Buffer,
        amount: string,
    ) => {
        await this.waitForInitialization();
        const program = new PublicKey(this.resolveTokenGatewayContract(asset));

        const to = `${asset}/to${this.name}`;

        const [renvmmsg] = this.constructRenVMMsg(
            pHash,
            amount,
            sHash,
            to,
            nHash,
        );

        const mintLogAccountId = await PublicKey.findProgramAddress(
            [keccak256(renvmmsg)],
            program,
        );

        const mintData = await this.provider.connection.getAccountInfo(
            mintLogAccountId[0],
            "processed",
        );

        if (!mintData) {
            this._config.logger.debug(
                "no mint for mint:",
                mintLogAccountId[0].toString(),
            );
            return undefined;
        }
        this._config.logger.debug("found mint:", mintData);

        const mintLogData = MintLogLayout.decode(mintData.data);
        if (!mintLogData.is_initialized) return undefined;

        try {
            const mintSigs =
                await this.provider.connection.getSignaturesForAddress(
                    mintLogAccountId[0],
                    undefined,
                    "confirmed",
                );
            return (mintSigs[0] && mintSigs[0].signature) || "";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // If getSignaturesForAddress threw an error, the network may be
            // on a version before 1.7, so this second method should be tried.
            // Once all relevant networks have been updated, this can be removed.
            try {
                const mintSigs =
                    await this.provider.connection.getConfirmedSignaturesForAddress2(
                        mintLogAccountId[0],
                        undefined,
                        "confirmed",
                    );
                return mintSigs[0].signature;
            } catch (errorInner) {
                // If both threw, throw the error returned from
                // `getSignaturesForAddress`.
                throw error;
            }
        }
    };

    /**
     * Fetch the mint and burn fees for an asset.
     */
    getFees(_asset: string) {
        // TODO: add getFees RPC endpoint; use RPC to provide fees
        return { burn: 15, mint: 15 };
    }

    /**
     * Fetch the addresses' balance of the asset's representation on the chain.
     */
    async getBalance(asset: string, address: SolAddress) {
        const tokenMintId = await this.getSPLTokenPubkey(asset);

        const source = await getAssociatedTokenAddress(
            new PublicKey(address),
            tokenMintId,
        );
        return new BigNumber(
            (
                await this.provider.connection.getTokenAccountBalance(source)
            ).value.amount,
        );
    }

    /*
     * Generates the mint parameters.
     */
    getMintParams = async (asset: string) => {
        await this.waitForInitialization();
        if (!this.renNetworkDetails || !this.provider) {
            throw new Error(
                `Solana must be initialized before calling 'getContractCalls'.`,
            );
        }

        const params = this._getParams && this._getParams();

        if (
            params &&
            params.contractCalls &&
            params.contractCalls.length > 0 &&
            params.contractCalls[0].contractFn === "mint"
        ) {
            return params;
        }

        const recipient =
            params && params.contractCalls
                ? new PublicKey(params.contractCalls[0].sendTo)
                : this.provider.wallet.publicKey;

        const destination = await tryNTimes(
            async () =>
                this.getAssociatedTokenAccount(asset, recipient.toString()),
            5,
            3 * SECONDS,
        );

        if (!destination) {
            // Once there's better documentation around
            // createAssociatedTokenAccount for developers, the error message
            // can be made more user-friendly.
            throw new Error(
                `No associated token account for ${recipient.toString()} - 'createAssociatedTokenAccount' needs to be called.`,
            );
        }

        const calls: OverwritableLockAndMintParams = {
            contractCalls: [
                {
                    sendTo: destination.toString(),
                    contractFn: "mint",
                    contractParams: [
                        {
                            name: "recipient",
                            type: "string",
                            value: recipient.toString(),
                            notInPayload: !this._config.includeAddressInPayload,
                        },
                    ],
                },
            ],
        };
        return calls;
    };

    Account({
        amount,
        value,
        address,
    }: {
        amount?: string | BigNumber;
        value?: string | BigNumber;
        address?: string;
    }) {
        this._getParams = (burnPayload?: string) => {
            const recipient = burnPayload || address;
            if (!recipient) {
                throw new Error("missing recipient");
            }
            const params: OverwritableBurnAndReleaseParams = {
                contractCalls: [
                    {
                        sendTo: recipient,
                        contractFn: "",
                        contractParams: [
                            {
                                name: "amount",
                                value: amount || value,
                                type: "string",
                            },
                            {
                                name: "recipient",
                                value: recipient,
                                type: "string",
                            },
                        ],
                    },
                ],
            };
            this._config.logger.debug("solana params:", params);
            return params;
        };
        return this;
    }

    Params(params: OverwritableBurnAndReleaseParams) {
        this._getParams = () => params;
        return this;
    }

    _getParams:
        | ((burnPayload?: string) => OverwritableBurnAndReleaseParams)
        | undefined;

    getBurnParams = (_asset: string, burnPayload?: string) => {
        if (!this._getParams || !burnPayload) return undefined;
        return this._getParams(burnPayload);
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    findBurn = async (
        asset: string,
        eventEmitter: EventEmitterTyped<{
            transaction: [ChainTransaction];
        }>,
        _transaction?: SolTransaction,
        burnNonce?: Buffer | string | number,
    ) => {
        await this.waitForInitialization();
        const program = new PublicKey(this.resolveTokenGatewayContract(asset));

        if (burnNonce === undefined) {
            return undefined;
        }

        let leNonce: Buffer;
        if (typeof burnNonce == "number") {
            leNonce = new BN(burnNonce).toBuffer("le", 8);
        } else if (typeof burnNonce == "string") {
            leNonce = Buffer.from(burnNonce);
        } else {
            leNonce = burnNonce;
        }

        const burnId = await PublicKey.findProgramAddress([leNonce], program);

        const burnInfo = await this.provider.connection.getAccountInfo(
            burnId[0],
        );
        if (burnInfo) {
            const burnData = BurnLogLayout.decode(burnInfo.data);
            const txes =
                await this.provider.connection.getConfirmedSignaturesForAddress2(
                    burnId[0],
                );

            // Concatenate four u64s into a u256 value.
            const burnAmount = new BN(
                Buffer.concat([
                    new BN(burnData.amount_section_1).toArrayLike(
                        Buffer,
                        "le",
                        8,
                    ),
                    new BN(burnData.amount_section_2).toArrayLike(
                        Buffer,
                        "le",
                        8,
                    ),
                    new BN(burnData.amount_section_3).toArrayLike(
                        Buffer,
                        "le",
                        8,
                    ),
                    new BN(burnData.amount_section_4).toArrayLike(
                        Buffer,
                        "le",
                        8,
                    ),
                ]),
            );

            // Convert borsh `Number` to built-in number
            const recipientLength = parseInt(burnData.recipient_len.toString());

            const burnDetails: BurnDetails<SolTransaction> = {
                transaction: txes[0].signature,
                amount: new BigNumber(burnAmount.toString()),
                to: base58.encode(burnData.recipient.slice(0, recipientLength)),
                nonce: new BigNumber(
                    new BN(leNonce, undefined, "le").toString(),
                ),
            };

            eventEmitter.emit("transactionHash", burnDetails.transaction);

            return burnDetails;
        }

        this._config.logger.info("missing burn:", burnNonce);
        return undefined;
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    submitBurn = async (
        asset: string,
        eventEmitter: EventEmitterTyped<{
            transaction: [ChainTransaction];
        }>,
        contractCalls: ContractCall[],
    ) => {
        await this.waitForInitialization();
        const program = new PublicKey(this.resolveTokenGatewayContract(asset));

        // We didn't find a burn, so create one instead
        if (
            !contractCalls ||
            !contractCalls[0] ||
            !contractCalls[0].contractParams
        )
            throw new Error("missing burn calls");

        this._config.logger.debug("burn contract calls:", contractCalls);

        const amount = contractCalls[0].contractParams[0].value;
        const recipient = Buffer.from(contractCalls[0].contractParams[1].value);

        const tokenMintId = await this.getSPLTokenPubkey(asset);

        const source = await getAssociatedTokenAddress(
            this.provider.wallet.publicKey,
            tokenMintId,
        );

        const checkedBurnInst = ActualToken.createBurnCheckedInstruction(
            TOKEN_PROGRAM_ID,
            tokenMintId,
            source,
            this.provider.wallet.publicKey,
            [],
            amount,
            await this.assetDecimals(asset),
        );

        const gatewayAccountId = await PublicKey.findProgramAddress(
            [new Uint8Array(Buffer.from(GatewayStateKey))],
            program,
        );

        const gatewayInfo = await this.provider.connection.getAccountInfo(
            gatewayAccountId[0],
        );

        if (!gatewayInfo) throw new Error("incorrect gateway program address");

        const gatewayState = GatewayLayout.decode(gatewayInfo.data);
        const nonceBN = new BN(gatewayState.burn_count).add(new BN(1));
        this._config.logger.debug("burn nonce: ", nonceBN.toString());

        const burnLogAccountId = await PublicKey.findProgramAddress(
            [Buffer.from(nonceBN.toArray("le", 8))],
            program,
        );

        // sensible defaults
        const isSigner = false;
        const isWritable = false;

        const renBurnInst = new TransactionInstruction({
            keys: [
                {
                    isSigner: true,
                    isWritable,
                    pubkey: this.provider.wallet.publicKey,
                },
                { isSigner, isWritable: true, pubkey: source },
                { isSigner, isWritable: true, pubkey: gatewayAccountId[0] },
                { isSigner, isWritable: true, pubkey: tokenMintId },
                { isSigner, isWritable: true, pubkey: burnLogAccountId[0] },
                {
                    pubkey: SystemProgram.programId,
                    isSigner,
                    isWritable,
                },
                {
                    pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,
                    isSigner,
                    isWritable,
                },
                {
                    pubkey: SYSVAR_RENT_PUBKEY,
                    isSigner,
                    isWritable,
                },
            ],
            data: Buffer.from([2, recipient.length, ...recipient]),
            programId: program,
        });

        this._config.logger.debug("burn tx: ", renBurnInst);

        const tx = new Transaction();
        tx.add(checkedBurnInst, renBurnInst);
        tx.recentBlockhash = (
            await this.provider.connection.getRecentBlockhash()
        ).blockhash;
        tx.feePayer = this.provider.wallet.publicKey;
        const signed = await this.provider.wallet.signTransaction(tx);
        if (!signed.signature) {
            throw new Error("missing signature");
        }

        const confirmOpts: ConfirmOptions = {
            commitment: "confirmed",
        };

        const confirmedSignature = await sendAndConfirmRawTransaction(
            this.provider.connection,
            signed.serialize(),
            confirmOpts,
        );

        // We unfortunatley cannot send the hash before the program has the tx.
        // burnAndRelease status assumes it is burned as soon as hash is available,
        // and submits the tx at that point; but the lightnode/darknode will fail to validate
        // because it is not present in the cluster yet
        // FIXME: this is not great, because it will be stuck in state where it is expecting a signature
        eventEmitter.emit("transactionHash", base58.encode(signed.signature));

        // Wait up to 20 seconds for the transaction to be finalized.
        await finalizeTransaction(this.provider.connection, confirmedSignature);

        const x: BurnDetails<SolTransaction> = {
            transaction: confirmedSignature,
            amount: new BigNumber(amount),
            to: recipient.toString(),
            nonce: new BigNumber(nonceBN.toString()),
        };
        return x;
    };

    /*
     * Solana specific utility for checking whether a token account has been
     * instantiated for the selected asset
     */
    async getAssociatedTokenAccount(
        asset: string,
        address?: string,
    ): Promise<PublicKey | false> {
        await this.waitForInitialization();

        const targetAddress = address
            ? new PublicKey(address)
            : this.provider.wallet.publicKey;

        const tokenMintId = await this.getSPLTokenPubkey(asset);
        const destination = await getAssociatedTokenAddress(
            targetAddress,
            tokenMintId,
        );

        try {
            const tokenAccount = await this.provider.connection.getAccountInfo(
                destination,
                "processed",
            );

            if (!tokenAccount || !tokenAccount.data) {
                return false;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
        return destination;
    }

    /*
     * Solana specific utility for creating a token account for a given user
     * @param asset The symbol of the token you wish to create an account for
     * @param address? If provided, will create the token account for the given solana address,
     *                 otherwise, use the address of the wallet connected to the provider
     */
    async createAssociatedTokenAccount(asset: string, address?: string) {
        await this.waitForInitialization();
        const tokenMintId = await this.getSPLTokenPubkey(asset);
        const targetAddress = address
            ? new PublicKey(address)
            : this.provider.wallet.publicKey;

        const existingTokenAccount = await this.getAssociatedTokenAccount(
            asset,
            address,
        );

        if (!existingTokenAccount) {
            const createTxInstruction = await createAssociatedTokenAccount(
                this.provider.wallet.publicKey,
                targetAddress,
                tokenMintId,
            );
            const createTx = new Transaction();
            createTx.add(createTxInstruction);
            createTx.feePayer = this.provider.wallet.publicKey;
            createTx.recentBlockhash = (
                await this.provider.connection.getRecentBlockhash()
            ).blockhash;
            const signedTx = await this.provider.wallet.signTransaction(
                createTx,
            );

            // This was previously "confirmed" but that resulted in
            // `getAssociatedTokenAccount` failing if called too quickly after
            // `createAssociatedTokenAccount`.
            const confirmOpts: ConfirmOptions = {
                commitment: "confirmed",
            };

            try {
                // Should be the same as `signature`.
                const confirmedSignature = await sendAndConfirmRawTransaction(
                    this.provider.connection,
                    signedTx.serialize(),
                    confirmOpts,
                );

                // Wait up to 20 seconds for the transaction to be finalized.
                await finalizeTransaction(
                    this.provider.connection,
                    confirmedSignature,
                );

                return confirmedSignature;
            } catch (e) {
                console.error(e);
                throw e;
            }
        } else {
            // Already generated, but we aren't guarenteed to get the tx
            return "";
        }
    }
}
