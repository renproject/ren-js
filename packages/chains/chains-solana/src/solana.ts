import BigNumber from "bignumber.js";
import base58 from "bs58";
import { Buffer } from "buffer";

import {
    createAssociatedTokenAccount,
    getAssociatedTokenAddress,
} from "@project-serum/associated-token";
import Wallet from "@project-serum/sol-wallet-adapter";
import {
    ChainTransaction,
    ContractChain,
    DefaultTxWaiter,
    InputChainTransaction,
    InputType,
    Logger,
    nullLogger,
    OutputType,
    populateChainTransaction,
    RenNetwork,
    RenNetworkString,
    TxSubmitter,
    TxWaiter,
    utils,
} from "@renproject/utils";
import {
    createBurnCheckedInstruction,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    Connection,
    CreateSecp256k1InstructionWithEthAddressParams,
    PublicKey,
    Signer,
    SystemProgram,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";

import {
    GatewayLayout,
    GatewayRegistryState,
    GatewayStateKey,
    MintLogLayout,
} from "./layouts";
import { resolveNetwork, SolNetworkConfig } from "./networks";
import { SolanaTxWaiter } from "./solanaTxSubmitter";
import { SolanaInputPayload, SolanaOutputPayload } from "./types/types";
import {
    constructRenVMMsg,
    createInstructionWithEthAddress2,
    getBurnFromNonce,
    getGatewayRegistryState,
    resolveTokenGatewayContract,
    txHashToChainTransaction,
    txidFormattedToTxid,
    txidToTxidFormatted,
} from "./utils";

interface SolOptions {
    logger?: Logger;
}

export class Solana
    implements ContractChain<SolanaInputPayload, SolanaOutputPayload>
{
    public static chain = "Solana" as const;
    public chain = Solana.chain;
    public static assets = {
        SOL: "SOL",
    };
    public assets: { [asset: string]: string } = {};

    public provider: Connection;
    public signer: Wallet | undefined;

    public network: SolNetworkConfig;

    private _logger: Logger;

    public constructor({
        network,
        provider,
        signer,
        config,
    }: {
        network: RenNetwork | RenNetworkString | SolNetworkConfig;
        provider: Connection;
        signer?: Wallet;
        config?: SolOptions;
    }) {
        if (!network) {
            throw new Error("Must provide a network.");
        }
        if (!provider) {
            throw new Error("Must provide a provider.");
        }
        this.provider = provider;
        this.signer = signer;
        this.network = resolveNetwork(network);
        this._logger = config && config.logger ? config.logger : nullLogger;
    }

    /**
     * A Solana address is a base58-encoded 32-byte ed25519 public key.
     */
    public validateAddress(address: string): boolean {
        try {
            return base58.decode(address).length === 32;
        } catch (error) {
            return false;
        }
    }

    /**
     * A Solana transaction's ID is a base58-encoded 64-byte signature.
     */
    public validateTransaction(transaction: ChainTransaction): boolean {
        try {
            const decoded = new Uint8Array(
                base58.decode(transaction.txidFormatted),
            );
            return (
                decoded.length === 64 &&
                utils.toURLBase64(decoded) === transaction.txid
            );
        } catch (error) {
            return false;
        }
    }

    public addressExplorerLink(address: string): string {
        return `${this.network.chainExplorer}/address/${address}?cluster=${this.network.chain}`;
    }

    public transactionExplorerLink(transaction: ChainTransaction): string {
        return `${this.network.chainExplorer}/tx/${transaction.txidFormatted}?cluster=${this.network.chain}`;
    }

    private _getGatewayRegistryData__memoized?: () => Promise<GatewayRegistryState>;
    // Wrapper to expose _getGatewayRegistryData as a class method instead of a
    // property.
    public async getGatewayRegistryData(): Promise<GatewayRegistryState> {
        this._getGatewayRegistryData__memoized =
            this._getGatewayRegistryData__memoized ||
            utils.memoize(async () => {
                return await getGatewayRegistryState(
                    this.provider,
                    this.network.addresses.GatewayRegistry,
                );
            });
        return this._getGatewayRegistryData__memoized();
    }

    public withProvider(provider: Connection): this {
        this.provider = provider;
        return this;
    }

    public withSigner(signer: Wallet): this {
        this.signer = signer;
        return this;
    }

    public isLockAsset(asset: string): boolean {
        return asset === this.network.symbol;
    }

    /**
     * `assetIsSupported` should return true if the the asset is native to the
     * chain or if the asset can be minted onto the chain.
     *
     * ```ts
     * ethereum.assetIsSupported = asset => asset === "ETH" || asset === "BTC" || ...;
     * ```
     */
    public async isMintAsset(asset: string): Promise<boolean> {
        const gatewayRegistryData = await this.getGatewayRegistryData();
        const gateway = resolveTokenGatewayContract(gatewayRegistryData, asset);

        return gateway !== undefined;
    }

    public async assetDecimals(asset: string): Promise<number> {
        if (asset === this.network.nativeAsset.symbol) {
            return this.network.nativeAsset.decimals;
        }

        const address = await this.getMintAsset(asset, { publicKey: true });
        const res = await this.provider.getTokenSupply(new PublicKey(address));

        return res.value.decimals;
    }

    public async transactionConfidence(
        transaction: ChainTransaction,
    ): Promise<BigNumber> {
        const tx = await this.provider.getConfirmedTransaction(
            transaction.txidFormatted,
        );

        const currentSlot = await this.provider.getSlot();
        return new BigNumber(currentSlot - (tx && tx.slot ? tx.slot : 0));
    }

    public formattedTransactionHash({ txid }: { txid: string }): string {
        return txidToTxidFormatted(txid);
    }

    public async getMintGateway<ReturnPublicKey extends true | false = false>(
        asset: string,
        { publicKey }: { publicKey?: ReturnPublicKey } = {},
    ): Promise<ReturnPublicKey extends true ? PublicKey : string> {
        const gatewayRegistryData = await this.getGatewayRegistryData();
        const gateway = resolveTokenGatewayContract(gatewayRegistryData, asset);
        if (!gateway) {
            throw new Error(`Unsupported asset ${asset}.`);
        }
        return (
            publicKey ? gateway : gateway.toBase58()
        ) as ReturnPublicKey extends true ? PublicKey : string;
    }

    public async getMintAsset<ReturnPublicKey extends true | false = false>(
        asset: string,
        { publicKey }: { publicKey?: ReturnPublicKey } = {},
    ): Promise<ReturnPublicKey extends true ? PublicKey : string> {
        const program = await this.getMintGateway(asset, { publicKey: true });
        const sHash = utils.keccak256(
            utils.fromUTF8String(`${asset}/toSolana`),
        );

        const tokenMintId = await PublicKey.findProgramAddress(
            [sHash],
            program,
        );
        return (
            publicKey ? tokenMintId[0] : tokenMintId[0].toBase58()
        ) as ReturnPublicKey extends true ? PublicKey : string;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getLockAsset<ReturnPublicKey extends true | false = false>(
        _asset: string,
        { publicKey: _publicKey }: { publicKey?: ReturnPublicKey } = {},
    ): Promise<ReturnPublicKey extends true ? PublicKey : string> {
        throw new Error(`Solana does not currently support lock assets.`);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getLockGateway<ReturnPublicKey extends true | false = false>(
        _asset: string,
        { publicKey: _publicKey }: { publicKey?: ReturnPublicKey } = {},
    ): Promise<ReturnPublicKey extends true ? PublicKey : string> {
        throw new Error(`Solana does not currently support lock assets.`);
    }

    public async getOutputPayload(
        asset: string,
        _inputType: InputType,
        _outputType: OutputType,
        contractCall: SolanaOutputPayload,
    ): Promise<{
        to: string;
        toBytes: Uint8Array;
        payload: Uint8Array;
    }> {
        const associatedTokenAccount = await this.getAssociatedTokenAccount(
            asset,
            contractCall.params.to,
        );
        return {
            to: associatedTokenAccount.toBase58(),
            toBytes: new Uint8Array(associatedTokenAccount.toBuffer()),
            payload: new Uint8Array(),
        };
    }

    /**
     * `submitMint` should take the completed mint transaction from RenVM and
     * submit its signature to the mint chain to finalize the mint.
     */
    public async getOutputTx(
        _inputType: InputType,
        _outputType: OutputType,
        asset: string,
        contractCall: SolanaOutputPayload,
        params: () => {
            sHash: Uint8Array;
            pHash: Uint8Array;
            nHash: Uint8Array;

            amount?: BigNumber;
            sigHash?: Uint8Array;
            signature?: Uint8Array;
        },
        confirmationTarget: number,
    ): Promise<TxSubmitter | TxWaiter> {
        const program = await this.getMintGateway(asset, { publicKey: true });

        const gatewayAccountId = await PublicKey.findProgramAddress(
            [utils.fromUTF8String(GatewayStateKey)],
            program,
        );
        const sHash = utils.keccak256(
            utils.fromUTF8String(`${asset}/toSolana`),
        );

        const isSigner = false;
        const isWritable = false;

        const tokenMintId = await this.getMintAsset(asset, { publicKey: true });

        const mintAuthorityId = await PublicKey.findProgramAddress(
            [tokenMintId.toBuffer()],
            program,
        );

        const associatedTokenAccount_ = await this.getAssociatedTokenAccount(
            asset,
            contractCall.params.to,
        );
        if (!associatedTokenAccount_) {
            throw new Error(`Associated token account not created yet.`);
        }
        const associatedTokenAccount = associatedTokenAccount_;

        const findExistingTransaction = async (): Promise<
            ChainTransaction | undefined
        > => {
            const { nHash, pHash, amount, signature } = params();
            if (!amount || !signature) {
                return undefined;
            }

            const to = associatedTokenAccount.toBase58();

            const [renVMMessage] = constructRenVMMsg(
                pHash,
                amount.toString(),
                sHash,
                to,
                nHash,
            );

            const mintLogAccountId = await PublicKey.findProgramAddress(
                [utils.keccak256(renVMMessage)],
                program,
            );

            const mintData = await this.provider.getAccountInfo(
                mintLogAccountId[0],
                "processed",
            );

            if (!mintData) {
                return undefined;
            }

            const mintLogData = MintLogLayout.decode(mintData.data);
            if (!mintLogData.is_initialized) return undefined;

            try {
                const mintSignatures =
                    await this.provider.getSignaturesForAddress(
                        mintLogAccountId[0],
                        undefined,
                        "confirmed",
                    );
                return txHashToChainTransaction(
                    this.chain,
                    (mintSignatures[0] && mintSignatures[0].signature) || "",
                );
            } catch (error) {
                // If getSignaturesForAddress threw an error, the network may be
                // on a version before 1.7, so this second method should be tried.
                // Once all relevant networks have been updated, this can be removed.
                try {
                    const mintSignatures =
                        await this.provider.getConfirmedSignaturesForAddress2(
                            mintLogAccountId[0],
                            undefined,
                            "confirmed",
                        );
                    return txHashToChainTransaction(
                        this.chain,
                        mintSignatures[0].signature,
                    );
                } catch (errorInner) {
                    // If both threw, throw the error returned from
                    // `getSignaturesForAddress`.
                    throw error;
                }
            }
        };

        const existingTransaction = await findExistingTransaction();

        if (existingTransaction) {
            return new DefaultTxWaiter({
                chainTransaction: existingTransaction,
                chain: this,
                target: confirmationTarget,
            });
        }

        // To get to this point, the token account should already exist.
        // const recipientWalletAddress =
        //     contractCall &&
        //     contractCall.contractParams &&
        //     contractCall.contractParams[0] &&
        //     contractCall.contractParams[0].value;
        // await this.createAssociatedTokenAccount(asset, recipientWalletAddress);

        const getTransaction = async (): Promise<Transaction> => {
            if (!this.signer) {
                throw new Error(`Must connect ${this.chain} signer.`);
            }
            if (!this.signer.publicKey) {
                throw new Error(
                    `${this.chain} signer not connected - must call \`signer.connect()\`.`,
                );
            }

            const { nHash, pHash, amount, signature } = params();
            if (!amount) {
                throw new Error(`Unable to fetch RenVM transaction amount.`);
            }

            if (!signature) {
                throw new Error(`Unable to fetch RenVM signature.`);
            }

            const to = associatedTokenAccount.toBase58();

            const [renVMMessage, renVMMessageSlice] = constructRenVMMsg(
                pHash,
                amount.toString(),
                sHash,
                to,
                nHash,
            );

            const mintLogAccountId = await PublicKey.findProgramAddress(
                [utils.keccak256(renVMMessage)],
                program,
            );
            this._logger.debug(
                "mint log account",
                mintLogAccountId[0].toString(),
            );

            // TODO: we may want to just return this for custom integrations.
            // users should be able to add this instruction to their
            // application's instruction set for composition.
            const instruction = new TransactionInstruction({
                keys: [
                    {
                        pubkey: this.signer.publicKey,
                        isSigner: true,
                        isWritable,
                    },
                    { pubkey: gatewayAccountId[0], isSigner, isWritable },
                    { pubkey: tokenMintId, isSigner, isWritable: true },
                    {
                        pubkey: associatedTokenAccount,
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

            // To get the current gateway pubkey
            const gatewayInfo = await this.provider.getAccountInfo(
                gatewayAccountId[0],
            );

            if (!gatewayInfo)
                throw new Error("incorrect gateway program address");

            const gatewayState = GatewayLayout.decode(gatewayInfo.data);

            const tx = new Transaction();

            // The instruction to check the signature
            const secpParams: CreateSecp256k1InstructionWithEthAddressParams = {
                ethAddress: gatewayState.renvm_authority,
                message: renVMMessageSlice,
                signature: signature.slice(0, 64),
                recoveryId: signature[64] - 27,
            };
            this._logger.debug(
                "authority address",
                utils.toHex(gatewayState.renvm_authority),
            );
            this._logger.debug("secp params", secpParams);

            const secPInstruction =
                createInstructionWithEthAddress2(secpParams);
            secPInstruction.data = Buffer.from([...secPInstruction.data]);

            tx.add(instruction, secPInstruction);

            tx.recentBlockhash = (
                await this.provider.getRecentBlockhash("confirmed")
            ).blockhash;
            tx.feePayer = this.signer.publicKey;

            return tx;
        };

        return new SolanaTxWaiter({
            chain: this.chain,
            target: confirmationTarget,
            provider: this.provider,
            getSigner: () => this.signer,
            getTransaction,
            findExistingTransaction,
        });
    }

    /**
     * Fetch the addresses' balance of the asset's representation on the chain.
     */
    public async getBalance(
        asset: string,
        address?: string,
    ): Promise<BigNumber> {
        if (!address) {
            if (!this.signer) {
                throw new Error(
                    `Must provide address or connect ${this.chain} signer.`,
                );
            }
            if (!this.signer.publicKey) {
                throw new Error(
                    `${this.chain} signer not connected - must provide address or call \`signer.connect()\`.`,
                );
            }
            address = this.signer.publicKey.toString();
        }

        if (asset === this.network.nativeAsset.symbol) {
            return new BigNumber(
                await this.provider.getBalance(new PublicKey(address)),
            );
        }

        const tokenMintId = await this.getMintAsset(asset, { publicKey: true });

        const source = await getAssociatedTokenAddress(
            new PublicKey(address),
            tokenMintId,
        );
        return new BigNumber(
            (await this.provider.getTokenAccountBalance(source)).value.amount,
        );
    }

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    public async getInputTx(
        _inputType: InputType,
        _outputType: OutputType,
        asset: string,
        contractCall: SolanaInputPayload,
        getParams: () => {
            toChain: string;
            toPayload: {
                to: string;
                payload: Uint8Array;
            };
            gatewayAddress?: string;
        },
        confirmationTarget: number,
        onInput: (input: InputChainTransaction) => void,
    ): Promise<TxSubmitter | TxWaiter> {
        let onReceiptCallback: (signature: string) => void;

        const onReceipt = (signature: string) => {
            if (onReceiptCallback) {
                onReceiptCallback(signature);
            }
        };

        const program = await this.getMintGateway(asset, {
            publicKey: true,
        });

        if (contractCall.type === "burnNonce") {
            const chainTransaction = await getBurnFromNonce(
                this.provider,
                this.chain,
                asset,
                program,
                contractCall.params.burnNonce,
            );
            if (!chainTransaction) {
                throw new Error(
                    `Burn details not found for burn with nonce ${String(
                        contractCall.params.burnNonce,
                    )}.`,
                );
            }
            return new DefaultTxWaiter({
                chainTransaction,
                chain: this,
                target: confirmationTarget,
                onFirstProgress: (tx: ChainTransaction) =>
                    onReceipt(tx.txidFormatted),
            });
        }

        if (contractCall.type === "transaction") {
            return new DefaultTxWaiter({
                chainTransaction: contractCall.params.tx,
                chain: this,
                target: confirmationTarget,
                onFirstProgress: (tx: ChainTransaction) =>
                    onReceipt(tx.txidFormatted),
            });
        }

        const getTransaction = async (): Promise<Transaction> => {
            if (!this.signer) {
                throw new Error(`Must connect ${this.chain} signer.`);
            }
            if (!this.signer.publicKey) {
                throw new Error(
                    `${this.chain} signer not connected - must call \`signer.connect()\`.`,
                );
            }

            const {
                params: { amount },
            } = contractCall;

            const recipient = utils.fromUTF8String(getParams().toPayload.to);

            const tokenMintId = await this.getMintAsset(asset, {
                publicKey: true,
            });

            const source = await getAssociatedTokenAddress(
                this.signer.publicKey,
                tokenMintId,
            );

            const checkedBurnInst = createBurnCheckedInstruction(
                source,
                tokenMintId,
                this.signer.publicKey,
                BigInt(
                    (BigNumber.isBigNumber(amount)
                        ? amount.toFixed()
                        : amount.toString()
                    ).toString(),
                ),
                await this.assetDecimals(asset),
            );

            const gatewayAccountId = await PublicKey.findProgramAddress(
                [utils.fromUTF8String(GatewayStateKey)],
                program,
            );

            const gatewayInfo = await this.provider.getAccountInfo(
                gatewayAccountId[0],
            );

            if (!gatewayInfo)
                throw new Error("incorrect gateway program address");

            const gatewayState = GatewayLayout.decode(gatewayInfo.data);
            const nonceBN = new BigNumber(
                gatewayState.burn_count.toString(),
            ).plus(1);
            this._logger.debug("burn nonce: ", nonceBN.toString());

            const burnLogAccountId = await PublicKey.findProgramAddress(
                [utils.toNBytes(nonceBN, 8, "le")],
                program,
            );

            const renBurnInst = new TransactionInstruction({
                keys: [
                    {
                        isSigner: true,
                        isWritable: false,
                        pubkey: this.signer.publicKey,
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: source,
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: gatewayAccountId[0],
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: tokenMintId,
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: burnLogAccountId[0],
                    },
                    {
                        pubkey: SystemProgram.programId,
                        isSigner: false,
                        isWritable: false,
                    },
                    {
                        pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,
                        isSigner: false,
                        isWritable: false,
                    },
                    {
                        pubkey: SYSVAR_RENT_PUBKEY,
                        isSigner: false,
                        isWritable: false,
                    },
                ],
                data: Buffer.from([2, recipient.length, ...recipient]),
                programId: program,
            });

            this._logger.debug("burn tx: ", renBurnInst);

            const tx = new Transaction();
            tx.add(checkedBurnInst, renBurnInst);
            tx.recentBlockhash = (
                await this.provider.getRecentBlockhash()
            ).blockhash;
            tx.feePayer = this.signer.publicKey;

            onReceiptCallback = (signature: string) => {
                const txid = utils.toURLBase64(base58.decode(signature));
                onInput({
                    chain: this.chain,
                    txid: txid,
                    txindex: "0",
                    asset,
                    txidFormatted: signature,
                    amount: new BigNumber(amount).toFixed(),
                    nonce: utils.toURLBase64(utils.toNBytes(nonceBN, 32)),
                    toRecipient: recipient.toString(),
                });
            };

            return tx;
            // const signed = await this.signer.signTransaction(tx);
            // if (!signed.signature) {
            //     throw new Error("missing signature");
            // }

            // const confirmOpts: ConfirmOptions = {
            //     commitment: "confirmed",
            // };

            // const confirmedSignature = await sendAndConfirmRawTransaction(
            //     this.provider,
            //     signed.serialize(),
            //     confirmOpts,
            // );

            // // Wait up to 20 seconds for the transaction to be finalized.
            // await finalizeTransaction(this.provider, confirmedSignature);
        };

        return new SolanaTxWaiter({
            chain: this.chain,
            target: confirmationTarget,
            provider: this.provider,
            getSigner: () => this.signer,
            getTransaction,
            onReceipt,
        });
    }

    public async associatedTokenAccountExists(asset: string): Promise<boolean> {
        const associatedTokenAddress = await this.getAssociatedTokenAccount(
            asset,
        );
        let setupRequired = false;
        try {
            const tokenAccount = await this.provider.getAccountInfo(
                associatedTokenAddress,
                "processed",
            );

            if (!tokenAccount || !tokenAccount.data) {
                setupRequired = true;
            }
        } catch (e) {
            console.error(e);
            setupRequired = true;
        }
        return !setupRequired;
    }

    public async getOutSetup(
        asset: string,
        _inputType: InputType,
        _outputType: OutputType,
        _contractCall: SolanaOutputPayload,
    ): Promise<{
        [key: string]: TxSubmitter | TxWaiter;
    }> {
        if (!(await this.associatedTokenAccountExists(asset))) {
            return {
                createTokenAccount: this.createAssociatedTokenAccount(asset),
            };
        }
        return {};
    }

    /*
     * Solana specific utility for checking whether a token account has been
     * instantiated for the selected asset
     */
    public async getAssociatedTokenAccount(
        asset: string,
        address?: string,
    ): Promise<PublicKey> {
        let targetAddress = address ? new PublicKey(address) : undefined;
        if (!targetAddress) {
            if (!this.signer) {
                throw new Error(`Must connect ${this.chain} signer.`);
            }
            if (!this.signer.publicKey) {
                throw new Error(
                    `${this.chain} signer not connected - must call \`signer.connect()\`.`,
                );
            }
            targetAddress = this.signer.publicKey;
        }

        const tokenMintId = await this.getMintAsset(asset, { publicKey: true });
        const destination = await getAssociatedTokenAddress(
            targetAddress,
            tokenMintId,
        );

        // try {
        //     const tokenAccount = await this.provider.getAccountInfo(
        //         destination,
        //         "processed",
        //     );

        //     if (!tokenAccount || !tokenAccount.data) {
        //         return undefined;
        //     }
        // } catch (e) {
        //     console.error(e);
        //     return undefined;
        // }
        return destination;
    }

    /*
     * Solana specific utility for creating a token account for a given user
     * @param asset The symbol of the token you wish to create an account for
     * @param address? If provided, will create the token account for the given solana address,
     *                 otherwise, use the address of the wallet connected to the provider
     */
    public createAssociatedTokenAccount(
        asset: string,
        address?: string,
    ): SolanaTxWaiter {
        const getTransaction = async (): Promise<Transaction> => {
            if (!this.signer) {
                throw new Error(`Must connect ${this.chain} signer.`);
            }
            if (!this.signer.publicKey) {
                throw new Error(
                    `${this.chain} signer not connected - must call \`signer.connect()\`.`,
                );
            }

            const tokenMintId = await this.getMintAsset(asset, {
                publicKey: true,
            });

            if (!this.signer) {
                throw new Error(`Must connect ${this.chain} signer.`);
            }
            if (!this.signer.publicKey) {
                throw new Error(
                    `${this.chain} signer not connected - must call \`signer.connect()\`.`,
                );
            }

            const targetAddress = address
                ? new PublicKey(address)
                : this.signer.publicKey;

            const createTxInstruction = await createAssociatedTokenAccount(
                this.signer.publicKey,
                targetAddress,
                tokenMintId,
            );
            const createTx = new Transaction();
            createTx.add(createTxInstruction);
            createTx.feePayer = this.signer.publicKey;
            createTx.recentBlockhash = (
                await this.provider.getRecentBlockhash()
            ).blockhash;

            return createTx;
        };

        const findExistingTransaction = async (): Promise<
            ChainTransaction | undefined
        > => {
            if (await this.associatedTokenAccountExists(asset)) {
                return {
                    chain: this.chain,
                    txid: "",
                    txindex: "0",
                    txidFormatted: "",
                };
            }
            return undefined;
        };

        return new SolanaTxWaiter({
            chain: this.chain,
            target: 1,
            provider: this.provider,
            getSigner: () => this.signer,
            getTransaction,
            findExistingTransaction,
        });
    }

    public Account({
        amount,
        address,
    }: {
        amount?: string | BigNumber;
        address?: string;
    } = {}): SolanaOutputPayload | SolanaInputPayload {
        if (amount) {
            const payload: SolanaInputPayload = {
                chain: this.chain,
                type: "burnToAddress",
                params: {
                    amount,
                },
            };
            return payload;
        }

        if (address) {
            const payload: SolanaOutputPayload = {
                chain: this.chain,
                type: "mintToAddress",
                params: {
                    to: address,
                },
            };
            return payload;
        }

        if (this.signer && this.signer.publicKey) {
            const payload: SolanaOutputPayload = {
                chain: this.chain,
                type: "mintToAddress",
                params: {
                    to: this.signer.publicKey.toString(),
                },
            };
            return payload;
        }

        throw new Error(`Must provide amount or address.`);
    }

    /**
     * Import an existing Solana transaction instead of watching for deposits
     * to a gateway address.
     *
     * @example
     * solana.Transaction({
     *   txidFormatted: "3mabcf8...",
     * })
     */
    public Transaction(
        partialTx: Partial<ChainTransaction>,
    ): SolanaInputPayload {
        return {
            chain: this.chain,
            type: "transaction",
            params: {
                tx: populateChainTransaction({
                    partialTx,
                    chain: this.chain,
                    txidToTxidFormatted,
                    txidFormattedToTxid,
                    defaultTxindex: "0",
                }),
            },
        };
    }
}
