import {
    BurnDetails,
    ContractCall,
    LockAndMintTransaction,
    Logger,
    MintChain,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
    OverwritableLockAndMintParams,
    SimpleLogger,
    OverwritableBurnAndReleaseParams,
    BurnPayloadConfig,
} from "@renproject/interfaces";
import { Callable, doesntError, keccak256 } from "@renproject/utils";
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    Secp256k1Program,
    SystemProgram,
    sendAndConfirmRawTransaction,
    ConfirmOptions,
    CreateSecp256k1InstructionWithPublicKeyParams,
    CreateSecp256k1InstructionWithEthAddressParams,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";

import {
    createAssociatedTokenAccount,
    getAssociatedTokenAddress,
} from "@project-serum/associated-token";

import { BN } from "bn.js";
import BigNumber from "bignumber.js";
import base58 from "bs58";
import { EventEmitter } from "events";

import { createInstructionWithEthAddress2 } from "./util";
import { renMainnet, resolveNetwork, SolNetworkConfig } from "./networks";
import {
    BurnLogLayout,
    GatewayLayout,
    GatewayStateKey,
    GatewayRegistryLayout,
    GatewayRegistryState,
    GatewayRegistryStateKey,
    MintLogLayout,
    RenVmMsgLayout,
} from "./layouts";

// FIXME: Typings are out of date, so lets fall back to good old any
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
    logger: Logger;
}

class SolanaClass
    implements MintChain<SolTransaction, SolAddress, SolNetworkConfig> {
    public static chain = "Solana" as const;
    public chain = Solana.chain;
    public name = Solana.chain;

    public renNetworkDetails: SolNetworkConfig;
    private _logger: Logger = new SimpleLogger();

    public burnPayloadConfig: BurnPayloadConfig = {
        bytes: true,
    };

    public provider: SolanaProvider;

    constructor(
        provider: SolanaProvider,
        renNetwork?:
            | RenNetwork
            | RenNetworkString
            | RenNetworkDetails
            | SolNetworkConfig,
        options?: SolOptions,
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
        if (options) {
            this._logger = options.logger;
        }
        this.initialize(this.renNetworkDetails!.name as RenNetwork);
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
                SolanaClass.utils.resolveChainNetwork(network) || renMainnet;

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
                SolanaClass.utils.resolveChainNetwork(network) || renMainnet;

            return `${resolvedNetwork.chainExplorer}/tx/${transaction}?cluster=${resolvedNetwork.chain}`;
        },
    };

    public utils = SolanaClass.utils as any;

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
    initialize = async (
        network: RenNetwork | RenNetworkString | RenNetworkDetails,
    ) => {
        this.renNetwork = SolanaClass.utils.resolveChainNetwork(network);

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
    };

    async waitForInitialization() {
        if (this._initialized === undefined) {
            this._initialized = this.initialize(
                this.renNetworkDetails.name,
            ).then(() => true);
        }
        return this._initialized;
    }

    withProvider = (provider: any) => {
        this.provider = provider;
        return this;
    };

    assetIsNative = (asset: string) => {
        return asset === "SOL";
    };

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
        if (this.assetIsNative(asset)) {
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
        this._logger.debug("tx", transaction);
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
        this._logger.debug("tx", transaction);
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

            this._logger.debug(
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
            this._logger.debug("renvmmsg encoded", renvmmsg);
            return [renvmmsg, renvmMsgSlice];
        } catch (e) {
            this._logger.debug("failed to encoded renvmmsg", e);
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
        eventEmitter: EventEmitter,
    ) => {
        await this.waitForInitialization();
        this._logger.debug("submitting mintTx:", mintTx);
        if (mintTx.out && mintTx.out.revert)
            throw new Error("Transaction reverted: " + mintTx.out.revert);
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

        const [renvmmsg, renvmMsgSlice] = this.constructRenVMMsg(
            Buffer.from(mintTx.out.phash.toString("hex"), "hex"),
            mintTx.out.amount.toString(),
            Buffer.from(s_hash.toString("hex"), "hex"),
            contractCalls[0].sendTo,
            Buffer.from(mintTx.out.nhash.toString("hex"), "hex"),
        );

        const mintLogAccountId = await PublicKey.findProgramAddress(
            [keccak256(renvmmsg)],
            program,
        );
        this._logger.debug("mint log account", mintLogAccountId[0].toString());

        const recipient = new PublicKey(contractCalls[0].sendTo);

        const recipientAccount = await this.provider.connection.getAccountInfo(
            recipient,
        );

        if (!recipientAccount) {
            throw new Error("Recipient account not found");
        }

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
                    pubkey: recipient,
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
        this._logger.debug("mint instruction", JSON.stringify(instruction));

        const gatewayInfo = await this.provider.connection.getAccountInfo(
            gatewayAccountId[0],
        );

        if (!gatewayInfo) throw new Error("incorrect gateway program address");

        const gatewayState = GatewayLayout.decode(gatewayInfo.data);

        const tx = new Transaction();

        const secpParams: CreateSecp256k1InstructionWithEthAddressParams = {
            ethAddress: Buffer.from(gatewayState.renvm_authority),
            message: renvmMsgSlice,
            signature: sig.slice(0, 64),
            recoveryId: sig[64] - 27,
        };
        this._logger.debug(
            "authority address",
            secpParams.ethAddress.toString("hex"),
        );
        this._logger.debug("secp params", secpParams);

        const secPInstruction = createInstructionWithEthAddress2(secpParams);
        secPInstruction.data = Buffer.from([...secPInstruction.data]);

        tx.add(instruction, secPInstruction);
        tx.recentBlockhash = (
            await this.provider.connection.getRecentBlockhash("max")
        ).blockhash;
        tx.feePayer = this.provider.wallet.publicKey;

        const simulationResult = await this.provider.connection.simulateTransaction(
            tx,
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
        // FIXME: we need to generalize these events
        eventEmitter.emit("transactionHash", base58.encode(signature));
        this._logger.debug("signed with signature", signature);

        const confirmOpts: ConfirmOptions = {
            commitment: "finalized",
        };

        const r = await sendAndConfirmRawTransaction(
            this.provider.connection,
            signed.serialize(),
            confirmOpts,
        );

        this._logger.debug("sent and confirmed", r);
        eventEmitter.emit("confirmation", {}, { status: true });

        return r;
    };

    findTransactionByDepositDetails = async (
        asset: string,
        sHash: Buffer,
        nHash: Buffer,
        pHash: Buffer,
        to: string,
        amount: string,
    ) => {
        await this.waitForInitialization();
        const program = new PublicKey(this.resolveTokenGatewayContract(asset));

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
        );

        if (!mintData) {
            this._logger.debug(
                "no mint for mint:",
                mintLogAccountId[0].toString(),
            );
            return undefined;
        }
        this._logger.debug("found mint:", mintData);

        const mintLogData = MintLogLayout.decode(mintData.data);
        if (!mintLogData.is_initialized) return undefined;

        const mintSigs = await this.provider.connection.getSignaturesForAddress(
            mintLogAccountId[0],
        );
        return mintSigs[0]?.signature || "";
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
     * NOTE: We need to ensure that the destination address is initialized,
     * so be sure to call createAssociatedTokenAccount(asset) first
     */
    getMintParams = async (asset: string) => {
        await this.waitForInitialization();
        if (!this.renNetworkDetails || !this.provider) {
            throw new Error(
                `Solana must be initialized before calling 'getContractCalls'.`,
            );
        }

        const contract = this.resolveTokenGatewayContract(asset);
        const program = new PublicKey(contract);

        // TODO: check that the gpubkey matches
        const gatewayAccountId = await PublicKey.findProgramAddress(
            [new Uint8Array(Buffer.from(GatewayStateKey))],
            program,
        );

        const gatewayInfo = await this.provider.connection.getAccountInfo(
            gatewayAccountId[0],
        );

        if (!gatewayInfo) throw new Error("incorrect gateway program address");

        const gatewayState = GatewayLayout.decode(gatewayInfo.data);
        console.debug(gatewayState.renvm_authority);

        const s_hash = keccak256(Buffer.from(asset + "/toSolana"));

        const tokenMintId = await PublicKey.findProgramAddress(
            [s_hash],
            program,
        );

        const destination = await getAssociatedTokenAddress(
            this.provider.wallet.publicKey,
            tokenMintId[0],
        );

        const calls: OverwritableLockAndMintParams = {
            contractCalls: [
                {
                    sendTo: destination.toString(),
                    contractFn: "mint",
                    contractParams: [],
                },
            ],
        };
        return calls;
    };

    Account({ amount }: { amount: string | BigNumber }) {
        this._getParams = (burnPayload: string) => {
            const recipientBytes = Buffer.from(burnPayload, "hex");
            const params: OverwritableBurnAndReleaseParams = {
                contractCalls: [
                    {
                        sendTo: burnPayload,
                        contractFn: "",
                        contractParams: [
                            {
                                name: "amount",
                                value: amount,
                                type: "string",
                            },
                            {
                                name: "recipient",
                                value: recipientBytes,
                                type: "bytes",
                            },
                        ],
                    },
                ],
            };
            this._logger.debug("burn params:", params);
            return params;
        };
        return this;
    }

    _getParams:
        | ((burnPayload: string) => OverwritableBurnAndReleaseParams)
        | undefined;

    getBurnParams = (_asset: string, burnPayload?: string) => {
        if (!this._getParams || !burnPayload) return undefined;
        return this._getParams(burnPayload);
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    findBurnTransaction = async (
        asset: string,
        burn: {
            transaction?: SolTransaction;
            burnNonce?: Buffer | string | number;
            contractCalls?: ContractCall[];
        },
        eventEmitter: EventEmitter,
        logger: Logger,
        _networkDelay?: number,
    ) => {
        await this.waitForInitialization();
        const program = new PublicKey(this.resolveTokenGatewayContract(asset));
        if (burn.burnNonce !== undefined) {
            let leNonce: Buffer;
            if (typeof burn.burnNonce == "number") {
                leNonce = new BN(burn.burnNonce).toBuffer("le", 8);
            } else if (typeof burn.burnNonce == "string") {
                leNonce = Buffer.from(burn.burnNonce);
            } else {
                leNonce = burn.burnNonce;
            }

            const burnId = await PublicKey.findProgramAddress(
                [leNonce],
                program,
            );

            const burnInfo = await this.provider.connection.getAccountInfo(
                burnId[0],
            );
            if (burnInfo) {
                const burnData = BurnLogLayout.decode(burnInfo.data);
                const txes = await this.provider.connection.getConfirmedSignaturesForAddress2(
                    burnId[0],
                );
                const burnDetails: BurnDetails<SolTransaction> = {
                    transaction: txes[0].signature,
                    amount: burnData.amount,
                    to: base58.encode(burnData.recipient),
                    nonce: new BigNumber(
                        new BN(leNonce, undefined, "le").toString(),
                    ),
                };
                return burnDetails;
            } else {
                this._logger.info("missing burn:", burn.burnNonce);
                logger.info("missing burn:", burn.burnNonce);
            }
        }

        // We didn't find a burn, so create one instead
        if (
            !burn.contractCalls ||
            !burn.contractCalls[0] ||
            !burn.contractCalls[0].contractParams
        )
            throw new Error("missing burn calls");

        this._logger.debug("burn contract calls:", burn.contractCalls);

        const amount = burn.contractCalls[0].contractParams[0].value;
        const recipient: Buffer = burn.contractCalls[0].contractParams[1].value;

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
        this._logger.debug("burn nonce: ", nonceBN.toString());

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

        this._logger.debug("burn tx: ", renBurnInst);

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
            commitment: "finalized",
        };

        const res = await sendAndConfirmRawTransaction(
            this.provider.connection,
            signed.serialize(),
            confirmOpts,
        );

        // We unfortunatley cannot send the hash before the program has the tx.
        // burnAndRelease status assumes it is burned as soon as hash is available,
        // and submits the tx at that point; but the lightnode/darknode will fail to validate
        // because it is not present in the cluster yet
        // FIXME: this is not great, because it will be stuck in state where it is expecting a signature
        eventEmitter.emit("txHash", base58.encode(signed.signature));

        eventEmitter.emit("confirmation", base58.encode(signed.signature));

        const x: BurnDetails<SolTransaction> = {
            transaction: res,
            amount: new BigNumber(amount),
            to: base58.encode(recipient),
            nonce: new BigNumber(nonceBN.toString()),
        };
        return x;
    };

    /*
     * Solana specific utility for checking whether a token account has been
     * instantiated for the selected asset
     */
    async getAssociatedTokenAccount(asset: string) {
        await this.waitForInitialization();

        const tokenMintId = await this.getSPLTokenPubkey(asset);
        const destination = await getAssociatedTokenAddress(
            this.provider.wallet.publicKey,
            tokenMintId,
        );

        const tokenAccount = await this.provider.connection.getAccountInfo(
            destination,
        );

        if (!tokenAccount || !tokenAccount.data) {
            return false;
        }
        return destination;
    }

    /*
     * Solana specific utility for creating a token account for a given user
     */
    async createAssociatedTokenAccount(asset: string) {
        await this.waitForInitialization();
        const tokenMintId = await this.getSPLTokenPubkey(asset);
        const existingTokenAccount = await this.getAssociatedTokenAccount(
            asset,
        );

        if (!existingTokenAccount) {
            const createTxInstruction = await createAssociatedTokenAccount(
                this.provider.wallet.publicKey,
                this.provider.wallet.publicKey,
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

            // Only wait until solana has seen the tx
            const confirmOpts: ConfirmOptions = {
                commitment: "confirmed",
            };

            return sendAndConfirmRawTransaction(
                this.provider.connection,
                signedTx.serialize(),
                confirmOpts,
            );
        } else {
            // Already generated, but we aren't guarenteed to get the tx
            return "";
        }
    }
}

export type Solana = SolanaClass;
// @dev Removes any static fields, except `utils`.
export const Solana = Callable(SolanaClass);
