import {
    BurnDetails,
    ContractCall,
    LockAndMintTransaction,
    Logger,
    MintChain,
    ChainStatic,
    RenNetwork,
    RenNetworkDetails,
    RenNetworkString,
    OverwritableLockAndMintParams,
    SimpleLogger,
    OverwritableBurnAndReleaseParams,
} from "@renproject/interfaces";
import { EventEmitter } from "events";
import { BN } from "bn.js";
import BigNumber from "bignumber.js";
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
} from "@solana/web3.js";
import { keccak256 } from "@renproject/utils";
import elliptic from "elliptic";
import base58 from "bs58";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import {
    createAssociatedTokenAccount,
    getAssociatedTokenAddress,
} from "@project-serum/associated-token";
import { renMainnet, resolveNetwork, SolNetworkConfig } from "./networks";
import {
    BurnLogLayout,
    GatewayLayout,
    GatewayRegistryLayout,
    GatewayRegistryState,
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

export class Solana
    implements MintChain<SolTransaction, SolAddress, SolNetworkConfig> {
    public static chain = "Solana";
    name: "Solana" = "Solana";

    renNetworkDetails: SolNetworkConfig;
    private _creatingTokenAccount: boolean = false;
    private _logger: Logger = new SimpleLogger();
    constructor(
        readonly provider: SolanaProvider,
        renNetwork?:
            | RenNetwork
            | RenNetworkString
            | RenNetworkDetails
            | SolNetworkConfig,
        options?: SolOptions,
    ) {
        this.initialize = this.initialize.bind(this);
        // Default to mainnet if not specified
        if (renNetwork) {
            this.renNetworkDetails = resolveNetwork(renNetwork);
        } else {
            this.renNetworkDetails = renMainnet;
        }
        if (options) {
            this._logger = options.logger;
        }
    }

    public utils: ChainStatic<any, string, any>["utils"] = {
        resolveChainNetwork: resolveNetwork,
        addressIsValid: (a: any) => {
            try {
                base58.decode(a);
                return true;
            } catch (_e) {
                return false;
            }
        },
        addressExplorerLink: (
            address: SolAddress,
            network:
                | RenNetwork
                | RenNetworkString
                | RenNetworkDetails
                | SolNetworkConfig,
        ): string => {
            const resolvedNetwork =
                this.utils.resolveChainNetwork(network) || renMainnet;

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
                this.utils.resolveChainNetwork(network) || renMainnet;

            return `${resolvedNetwork.chainExplorer}/tx/${transaction}?cluster=${resolvedNetwork.chain}`;
        },
    };

    /**
     * Should be set by `constructor` or `initialize`.
     */
    renNetwork?: RenNetworkDetails;

    gatewayRegistryData?: GatewayRegistryState;
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
        this.renNetwork = this.utils.resolveChainNetwork(network);

        // Load registry state to find programs
        const pubk = new PublicKey(
            this.renNetworkDetails.addresses.GatewayRegistry,
        );
        const stateKey = await PublicKey.findProgramAddress(
            [new Uint8Array(Buffer.from("GatewayRegistryState"))],
            pubk,
        );

        const gatewayData = await this.provider.connection.getAccountInfo(
            stateKey[0],
        );

        if (!gatewayData) throw new Error("Failed to load program state");
        // Persist registry data
        // TODO: Consider if we want to handle the edge case of programs being
        // updated during the lifecyle of the chain pbject
        this.gatewayRegistryData = GatewayRegistryLayout.decode(
            gatewayData.data,
        );

        return this;
    };

    withProvider = (provider: any) => {
        return { ...this, provider };
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
        if (this.assetIsNative(asset)) {
            return true;
        }

        const sHash = Uint8Array.from(
            keccak256(Buffer.from(`${asset}/toSolana`)),
        );
        if (
            this.gatewayRegistryData?.selectors.find(
                (x) => x.toString() === sHash.toString(),
            )
        ) {
            return true;
        }
        return false;
    };

    // TODO: check if we can derive the decimals from token metadata
    assetDecimals = async (asset: string) => {
        const address = this.resolveTokenGatewayContract(asset);
        if (!address) throw new Error("unsupported asset: " + asset);
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
        // NOTE: Solana has a built in submit and wait until target confirmations
        // function; so it might not make sense to use this?
        const tx = await this.provider.connection.getConfirmedTransaction(
            transaction,
        );

        const currentSlot = await this.provider.connection.getSlot();
        return {
            current: currentSlot - (tx?.slot ?? 0),
            // TODO: get confirmation target from RPC
            target: 1,
        };
    };

    transactionRPCFormat = (transaction: SolTransaction) => {
        this._logger.debug("tx", transaction);
        return {
            txid: base58.decode(transaction),
            txindex: "0",
        };
    };

    transactionFromID = (
        txid: string | Buffer,
        _txindex: string,
        _reversed?: boolean,
    ) => {
        if (typeof txid == "string") return txid;
        return base58.encode(txid);
    };

    resolveTokenGatewayContract = (asset: string) => {
        if (!this.gatewayRegistryData) {
            throw new Error("chain not initialized");
        }

        const sHash = Uint8Array.from(
            keccak256(Buffer.from(`${asset}/toSolana`)),
        );
        let idx = -1;
        const contract = this.gatewayRegistryData?.selectors.find(
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
        const program = new PublicKey(this.resolveTokenGatewayContract(asset));
        const s_hash = keccak256(Buffer.from(`${asset}/toSolana`));

        const tokenMintId = await PublicKey.findProgramAddress(
            [s_hash],
            program,
        );
        return tokenMintId[0];
    }

    /**
     * `submitMint` should take the completed mint transaction from RenVM and
     * submit its signature to the mint chain to finalize the mint.
     */

    submitMint = async (
        asset: string,
        contractCalls: ContractCall[],
        mintTx: LockAndMintTransaction,
        eventEmitter: EventEmitter,
        lockState: any,
    ) => {
        this._logger.debug("submitting mintTx:", mintTx);
        if (mintTx.out?.revert)
            throw new Error("Transaction reverted: " + mintTx.out.revert);
        if (!mintTx.out?.signature) throw new Error("Missing signature");
        let sig = mintTx.out.signature;
        // FIXME: Not sure why this happens when retrieving the tx by polling for submission result
        if (typeof sig === "string") {
            sig = Buffer.from(sig, "hex");
        }

        const program = new PublicKey(this.resolveTokenGatewayContract(asset));

        const gatewayAccountId = await PublicKey.findProgramAddress(
            [new Uint8Array(Buffer.from("GatewayStateV0.1.1"))],
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

        const renvmmsg = Buffer.from(new Array(136));
        const preencode = {
            s_hash: new Uint8Array(s_hash),
            p_hash: new Uint8Array(lockState.pHash),
            to: new Uint8Array(base58.decode(contractCalls[0].sendTo)),
            n_hash: new Uint8Array(lockState.nHash),
            amount: new BN(lockState.amount),
        };
        this._logger.debug(
            "renvmmsg preencode",
            JSON.stringify({
                s_hash,
                p_hash: lockState.pHash,
                to: base58.decode(contractCalls[0].sendTo),
                n_hash: lockState.nHash,
                amount: new BN(lockState.amount),
            }),
        );

        const renvmMsgSlice = Buffer.from([
            ...preencode.p_hash,
            ...preencode.amount.toArray("le", 8),
            ...preencode.s_hash,
            ...preencode.to,
            ...preencode.n_hash,
        ]);
        RenVmMsgLayout.encode(preencode, renvmmsg);

        const mintLogAccountId = await PublicKey.findProgramAddress(
            [keccak256(renvmmsg)],
            program,
        );
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

        const tx = new Transaction();

        const ec = new elliptic.ec("secp256k1");
        const key = ec.keyFromPublic(lockState.gPubKey);
        const secpParams: CreateSecp256k1InstructionWithPublicKeyParams = {
            publicKey: Buffer.from(
                key.getPublic().encode("hex", false),
                "hex",
            ).slice(1, 65),
            message: renvmMsgSlice,
            signature: sig.slice(0, 64),
            recoveryId: sig[64] - 27,
        };
        this._logger.debug(
            "authority address",
            secpParams.publicKey.toString("hex"),
        );
        this._logger.debug("secp params", secpParams);

        const secPInstruction = Secp256k1Program.createInstructionWithPublicKey(
            secpParams,
        );
        secPInstruction.data = Buffer.from([0, ...secPInstruction.data]);
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

        const confirmOpts: ConfirmOptions = {
            commitment: "finalized",
        };

        const r = await sendAndConfirmRawTransaction(
            this.provider.connection,
            signed.serialize(),
            confirmOpts,
        );

        this._logger.debug("sent and confirmed", signature);
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
        const program = new PublicKey(this.resolveTokenGatewayContract(asset));
        const renvmmsg = Buffer.from(new Array(136));
        const preencode = {
            s_hash: new Uint8Array(sHash),
            p_hash: new Uint8Array(pHash),
            to: new Uint8Array(base58.decode(to)),
            n_hash: new Uint8Array(nHash),
            amount: new BN(amount),
        };
        this._logger.debug("find preencode", preencode);
        RenVmMsgLayout.encode(
            {
                s_hash: new Uint8Array(sHash),
                p_hash: new Uint8Array(pHash),
                to: new Uint8Array(base58.decode(to)),
                n_hash: new Uint8Array(nHash),
                amount: new BN(amount),
            },
            renvmmsg,
        );

        const mintLogAccountId = await PublicKey.findProgramAddress(
            [keccak256(renvmmsg)],
            program,
        );

        const mintData = await this.provider.connection.getAccountInfo(
            mintLogAccountId[0],
        );
        this._logger.debug("found mint:", mintData);

        if (!mintData) return undefined;
        const mintLogData = MintLogLayout.decode(mintData.data);
        if (!mintLogData.is_initialized) return undefined;

        const mintSigs = await this.provider.connection.getConfirmedSignaturesForAddress2(
            mintLogAccountId[0],
        );
        return mintSigs[0].signature;
    };

    /**
     * Fetch the mint and burn fees for an asset.
     */
    getFees(_asset: string) {
        return { burn: 0, mint: 0 };
    }

    /**
     * Fetch the addresses' balance of the asset's representation on the chain.
     */
    getBalance(_asset: string, _address: SolAddress) {
        return new BigNumber(0);
    }

    getMintParams = async (asset: string) => {
        if (!this.renNetworkDetails || !this.provider) {
            throw new Error(
                `Solana must be initialized before calling 'getContractCalls'.`,
            );
        }

        const contract = this.resolveTokenGatewayContract(asset);
        const program = new PublicKey(contract);

        const s_hash = keccak256(Buffer.from(asset + "/toSolana"));

        const tokenMintId = await PublicKey.findProgramAddress(
            [s_hash],
            program,
        );

        const destination = await getAssociatedTokenAddress(
            this.provider.wallet.publicKey,
            tokenMintId[0],
        );
        const tokenAccount = await this.provider.connection.getAccountInfo(
            destination,
        );
        if (
            !this._creatingTokenAccount &&
            (!tokenAccount || !tokenAccount.data)
        ) {
            this._creatingTokenAccount = true;
            const createTxInstruction = await createAssociatedTokenAccount(
                this.provider.wallet.publicKey,
                this.provider.wallet.publicKey,
                tokenMintId[0],
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

            await sendAndConfirmRawTransaction(
                this.provider.connection,
                signedTx.serialize(),
                confirmOpts,
            );
            this._creatingTokenAccount = false;
        }

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
                        contractFn: "burn",
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
        _logger: Logger,
        _networkDelay?: number,
    ) => {
        const program = new PublicKey(this.resolveTokenGatewayContract(asset));
        if (burn.burnNonce) {
            let leNonce: Buffer;
            if (typeof burn.burnNonce == "number") {
                leNonce = new BN(burn.burnNonce).toBuffer("le");
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
            9,
        );

        const gatewayAccountId = await PublicKey.findProgramAddress(
            [new Uint8Array(Buffer.from("GatewayStateV0.1.1"))],
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
}
