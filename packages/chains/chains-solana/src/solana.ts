import { Buffer } from "buffer";

import {
    createAssociatedTokenAccount,
    getAssociatedTokenAddress,
} from "@project-serum/associated-token";
import Wallet from "@project-serum/sol-wallet-adapter";
import {
    ChainTransaction,
    ContractChain,
    defaultLogger,
    DefaultTxWaiter,
    InputChainTransaction,
    InputType,
    Logger,
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
    SystemProgram,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import base58 from "bs58";

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
    getBurnFromTxid,
    getGatewayRegistryState,
    isBase58,
    resolveTokenGatewayContract,
    txHashFromBytes,
    txHashToBytes,
    txHashToChainTransaction,
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
        provider?: Connection | string;
        signer?: Wallet;
        config?: SolOptions;
    }) {
        if (!network) {
            throw new Error("Must provide a network.");
        }
        this.signer = signer;
        this.network = resolveNetwork(network);
        this.provider =
            typeof provider === "string" || !provider
                ? new Connection(provider || this.network.endpoint)
                : provider;
        this._logger = config && config.logger ? config.logger : defaultLogger;
    }

    /**
     * A Solana address is a base58-encoded 32-byte ed25519 public key.
     */
    public validateAddress = (address: string): boolean => {
        try {
            return base58.decode(address).length === 32;
        } catch (error: unknown) {
            return false;
        }
    };

    /**
     * A Solana transaction's ID is a base58-encoded 64-byte signature.
     */
    public validateTransaction = (
        transaction: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string } | { txidFormatted: string }),
    ): boolean => {
        return (
            (utils.isDefined(transaction.txid) ||
                utils.isDefined(transaction.txHash) ||
                utils.isDefined(transaction.txidFormatted)) &&
            (transaction.txHash
                ? isBase58(transaction.txHash, {
                      length: 64,
                  })
                : true) &&
            (transaction.txidFormatted
                ? isBase58(transaction.txidFormatted, {
                      length: 64,
                  })
                : true) &&
            (transaction.txid
                ? utils.isURLBase64(transaction.txid, {
                      length: 64,
                  })
                : true) &&
            (transaction.txindex
                ? !new BigNumber(transaction.txindex).isNaN()
                : true) &&
            (transaction.txHash && transaction.txid
                ? utils.toURLBase64(this.txHashToBytes(transaction.txHash)) ===
                  transaction.txid
                : true) &&
            (transaction.txidFormatted && transaction.txid
                ? utils.toURLBase64(
                      this.txHashToBytes(transaction.txidFormatted),
                  ) === transaction.txid
                : true) &&
            (transaction.txHash && transaction.txidFormatted
                ? transaction.txHash === transaction.txidFormatted
                : true) &&
            (transaction.txindex === undefined || transaction.txindex === "0")
        );
    };

    public addressExplorerLink = (address: string): string => {
        return `${this.network.chainExplorer}/address/${address}?cluster=${this.network.chain}`;
    };

    public transactionExplorerLink = ({
        txid,
        txHash,
        txidFormatted,
    }: Partial<ChainTransaction> &
        ({ txid: string } | { txHash: string } | { txidFormatted: string })):
        | string
        | undefined => {
        const hash =
            txHash ||
            txidFormatted ||
            (txid && this.txidToTxidFormatted({ txid }));
        if (!hash) {
            return "";
        }
        return hash
            ? `${this.network.chainExplorer}/tx/${String(hash)}?cluster=${
                  this.network.chain
              }`
            : undefined;
    };

    private _getGatewayRegistryData__memoized?: () => Promise<GatewayRegistryState>;
    // Wrapper to expose _getGatewayRegistryData as a class method instead of a
    // property.
    public getGatewayRegistryData = async (): Promise<GatewayRegistryState> => {
        this._getGatewayRegistryData__memoized =
            this._getGatewayRegistryData__memoized ||
            utils.memoize(async () => {
                return await getGatewayRegistryState(
                    this.provider,
                    this.network.addresses.GatewayRegistry,
                );
            });
        return this._getGatewayRegistryData__memoized();
    };

    public withProvider = (provider: Connection): this => {
        this.provider = provider;
        return this;
    };

    public withSigner = (signer: Wallet): this => {
        this.signer = signer;
        return this;
    };

    public isLockAsset = (asset: string): boolean => {
        return asset === this.network.symbol;
    };

    /**
     * `assetIsSupported` should return true if the the asset is native to the
     * chain or if the asset can be minted onto the chain.
     *
     * ```ts
     * ethereum.assetIsSupported = asset => asset === "ETH" || asset === "BTC" || ...;
     * ```
     */
    public isMintAsset = async (asset: string): Promise<boolean> => {
        const gatewayRegistryData = await this.getGatewayRegistryData();
        const gateway = resolveTokenGatewayContract(gatewayRegistryData, asset);

        return gateway !== undefined;
    };

    public assetDecimals = async (asset: string): Promise<number> => {
        if (asset === this.network.nativeAsset.symbol) {
            return this.network.nativeAsset.decimals;
        }

        const address = await this.getMintAsset(asset, { publicKey: true });
        const res = await this.provider.getTokenSupply(new PublicKey(address));

        return res.value.decimals;
    };

    public transactionConfidence = async (
        transaction: ChainTransaction,
    ): Promise<BigNumber> => {
        const tx = await this.provider.getTransaction(
            (transaction.txHash || transaction.txidFormatted) as string,
            { commitment: "confirmed" },
        );

        const currentSlot = await this.provider.getSlot();
        return new BigNumber(currentSlot - (tx && tx.slot ? tx.slot : 0));
    };

    public addressToBytes = (address: string): Uint8Array => {
        throw base58.decode(address);
    };

    public addressFromBytes = (bytes: Uint8Array): string => {
        return base58.encode(bytes);
    };

    public txHashToBytes = (txHash: string): Uint8Array => {
        return txHashToBytes(txHash);
    };

    public txHashFromBytes = (bytes: Uint8Array): string => {
        return txHashFromBytes(bytes);
    };

    /** @deprecated Replace with `utils.toURLBase64(txHashToBytes(txHash))`. */
    public txidFormattedToTxid = (txHash: string): string => {
        return utils.toURLBase64(txHashToBytes(txHash));
    };

    /** @deprecated Replace with `txHashFromBytes(utils.fromBase64(txid))`. */
    public txidToTxidFormatted = ({ txid }: { txid: string }): string => {
        return txHashFromBytes(utils.fromBase64(txid));
    };

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

    public getOutputPayload = async (
        asset: string,
        _inputType: InputType,
        _outputType: OutputType,
        contractCall: SolanaOutputPayload,
    ): Promise<{
        to: string;
        toBytes: Uint8Array;
        payload: Uint8Array;
    }> => {
        const associatedTokenAccount = await this.getAssociatedTokenAccount(
            asset,
            contractCall.params.to,
        );
        return {
            to: associatedTokenAccount.toBase58(),
            toBytes: new Uint8Array(associatedTokenAccount.toBuffer()),
            payload: new Uint8Array(),
        };
    };

    /**
     * `submitMint` should take the completed mint transaction from RenVM and
     * submit its signature to the mint chain to finalize the mint.
     */
    public getOutputTx = async (
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
    ): Promise<TxSubmitter | TxWaiter> => {
        const mintGateway = await this.getMintGateway(asset, {
            publicKey: true,
        });

        const mintGatewayStateAddress = (
            await PublicKey.findProgramAddress(
                [utils.fromUTF8String(GatewayStateKey)],
                mintGateway,
            )
        )[0];

        const sHash = utils.keccak256(
            utils.fromUTF8String(`${asset}/toSolana`),
        );

        const isSigner = false;
        const isWritable = false;

        const tokenMintId = await this.getMintAsset(asset, { publicKey: true });

        const mintAuthorityId = await PublicKey.findProgramAddress(
            [tokenMintId.toBuffer()],
            mintGateway,
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
                mintGateway,
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
            } catch (error: unknown) {
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

        const getTransaction = async (): Promise<{
            transaction: Transaction;
        }> => {
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
                mintGateway,
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
                    { pubkey: mintGatewayStateAddress, isSigner, isWritable },
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
                programId: mintGateway,
                data: Buffer.from([1]),
            });
            this._logger.debug("mint instruction", JSON.stringify(instruction));

            // To get the current gateway pubkey
            const encodedGatewayState = await this.provider.getAccountInfo(
                mintGatewayStateAddress,
            );

            if (!encodedGatewayState) {
                throw new Error("incorrect gateway program address");
            }

            const gatewayState = GatewayLayout.decode(encodedGatewayState.data);

            const transaction = new Transaction();

            // The instruction to check the signature
            const secpParams: CreateSecp256k1InstructionWithEthAddressParams = {
                ethAddress: gatewayState.renvm_authority,
                message: renVMMessageSlice,
                signature: signature.slice(0, 64),
                recoveryId: signature[64] % 27,
            };
            this._logger.debug(
                "authority address",
                utils.toHex(gatewayState.renvm_authority),
            );
            this._logger.debug("secp params", secpParams);

            const secPInstruction =
                createInstructionWithEthAddress2(secpParams);
            secPInstruction.data = Buffer.from([...secPInstruction.data]);

            transaction.add(instruction, secPInstruction);

            transaction.recentBlockhash = (
                await this.provider.getRecentBlockhash("confirmed")
            ).blockhash;
            transaction.feePayer = this.signer.publicKey;

            return { transaction };
        };

        return new SolanaTxWaiter({
            chain: this.chain,
            target: confirmationTarget,
            provider: this.provider,
            getSigner: () => this.signer,
            getTransaction,
            findExistingTransaction,
        });
    };

    /**
     * Fetch the addresses' balance of the asset's representation on the chain.
     */
    public getBalance = async (
        asset: string,
        address?: string,
    ): Promise<BigNumber> => {
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
    };

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     */
    public getInputTx = async (
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
    ): Promise<TxSubmitter | TxWaiter> => {
        const { toPayload } = getParams();
        if (toPayload && toPayload.payload.length > 0) {
            throw new Error(
                `Solana burns do not currently allow burning with a payload. For releasing to EVM chains, use \`evmChain.Account({ anyoneCanSubmit: false })\`.`,
            );
        }

        const mintGateway = await this.getMintGateway(asset, {
            publicKey: true,
        });

        const mintGatewayStateAddress = (
            await PublicKey.findProgramAddress(
                [utils.fromUTF8String(GatewayStateKey)],
                mintGateway,
            )
        )[0];

        const onReceipt = async (txHash: string, nonce?: number) => {
            const burnDetails = await utils.tryNTimes(
                () =>
                    getBurnFromTxid(
                        this.provider,
                        this.chain,
                        asset,
                        mintGateway,
                        txHash,
                        nonce,
                    ),
                5,
                5 * utils.sleep.SECONDS,
            );
            if (!burnDetails) {
                throw new Error(
                    `Unable to get burn details from transaction ${txHash}`,
                );
            }
            onInput(burnDetails);
        };

        if (contractCall.type === "burnNonce") {
            const chainTransaction = await getBurnFromNonce(
                this.provider,
                this.chain,
                asset,
                mintGateway,
                contractCall.params.burnNonce,
            );
            if (!chainTransaction) {
                throw new Error(
                    `Burn details not found for burn with nonce ${String(
                        contractCall.params.burnNonce,
                    )}.`,
                );
            }
            onInput(chainTransaction);
            return new DefaultTxWaiter({
                chainTransaction,
                chain: this,
                target: confirmationTarget,
                onFirstProgress: (tx: ChainTransaction) =>
                    onReceipt((tx.txHash || tx.txidFormatted)!),
            });
        }

        if (contractCall.type === "transaction") {
            return new DefaultTxWaiter({
                chainTransaction: contractCall.params.tx,
                chain: this,
                target: confirmationTarget,
                onFirstProgress: (tx: ChainTransaction) =>
                    onReceipt((tx.txHash || tx.txidFormatted)!),
            });
        }

        const getTransaction = async (): Promise<{
            transaction: Transaction;
            nonce: number;
        }> => {
            if (!this.signer) {
                throw new Error(`Must connect ${this.chain} signer.`);
            }
            if (!this.signer.publicKey) {
                throw new Error(
                    `${this.chain} signer not connected - must call \`signer.connect()\`.`,
                );
            }

            const {
                params: { amount: amount_, convertUnit },
            } = contractCall;

            const amount = convertUnit
                ? new BigNumber(amount_).shiftedBy(
                      await this.assetDecimals(asset),
                  )
                : new BigNumber(amount_);

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
                BigInt(amount.toFixed()),
                await this.assetDecimals(asset),
            );

            // Fetch gateway state.
            const encodedGatewayState = await this.provider.getAccountInfo(
                mintGatewayStateAddress,
            );
            if (!encodedGatewayState) {
                throw new Error("incorrect gateway program address");
            }
            const gatewayState = GatewayLayout.decode(encodedGatewayState.data);

            const nonceBN = new BigNumber(
                gatewayState.burn_count.toString(),
            ).plus(1);
            this._logger.debug("burn nonce: ", nonceBN.toFixed());

            const burnLogAccountId = await PublicKey.findProgramAddress(
                [utils.toNBytes(nonceBN, 8, "le")],
                mintGateway,
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
                        pubkey: mintGatewayStateAddress,
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
                programId: mintGateway,
            });

            this._logger.debug("burn tx: ", renBurnInst);

            const transaction = new Transaction();
            transaction.add(checkedBurnInst, renBurnInst);
            transaction.recentBlockhash = (
                await this.provider.getRecentBlockhash()
            ).blockhash;
            transaction.feePayer = this.signer.publicKey;

            return { transaction, nonce: nonceBN.toNumber() };
        };

        return new SolanaTxWaiter({
            chain: this.chain,
            target: confirmationTarget,
            provider: this.provider,
            getSigner: () => this.signer,
            getTransaction,
            onReceipt,
        });
    };

    public associatedTokenAccountExists = async (
        asset: string,
        address?: string,
    ): Promise<boolean> => {
        const associatedTokenAddress = await this.getAssociatedTokenAccount(
            asset,
            address,
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
            this._logger.error(e);
            setupRequired = true;
        }
        return !setupRequired;
    };

    public getOutSetup = async (
        asset: string,
        _inputType: InputType,
        _outputType: OutputType,
        contractCall: SolanaOutputPayload,
    ): Promise<{
        [key: string]: TxSubmitter | TxWaiter;
    }> => {
        if (
            !(await this.associatedTokenAccountExists(
                asset,
                contractCall.params.to,
            ))
        ) {
            return {
                createTokenAccount: this.createAssociatedTokenAccount(asset),
            };
        }
        return {};
    };

    /*
     * Solana specific utility for checking whether a token account has been
     * instantiated for the selected asset
     */
    public getAssociatedTokenAccount = async (
        asset: string,
        address?: string,
    ): Promise<PublicKey> => {
        console.log("address", address);
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
    };

    /*
     * Solana specific utility for creating a token account for a given user
     * @param asset The symbol of the token you wish to create an account for
     * @param address? If provided, will create the token account for the given solana address,
     *                 otherwise, use the address of the wallet connected to the provider
     */
    public createAssociatedTokenAccount = (
        asset: string,
        address?: string,
    ): SolanaTxWaiter => {
        const getTransaction = async (): Promise<{
            transaction: Transaction;
        }> => {
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
            const transaction = new Transaction();
            transaction.add(createTxInstruction);
            transaction.feePayer = this.signer.publicKey;
            transaction.recentBlockhash = (
                await this.provider.getRecentBlockhash()
            ).blockhash;

            return { transaction };
        };

        const findExistingTransaction = async (): Promise<
            ChainTransaction | undefined
        > => {
            if (await this.associatedTokenAccountExists(asset, address)) {
                return {
                    chain: this.chain,
                    txid: "",
                    txindex: "0",
                    txHash: "",

                    /** @deprecated Renamed to `txHash`. */
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
    };

    public Account = ({
        amount,
        convertUnit,
        address,
    }: {
        address?: string;
        amount?: BigNumber | string | number;
        convertUnit?: boolean;
    } = {}): SolanaOutputPayload | SolanaInputPayload => {
        if (amount) {
            return {
                chain: this.chain,
                type: "burnToAddress",
                params: {
                    amount: BigNumber.isBigNumber(amount)
                        ? amount.toFixed()
                        : amount,
                    convertUnit,
                    address,
                },
            };
        }

        if (address) {
            return this.Address(address);
        }

        if (!this.signer || !this.signer.publicKey) {
            throw new Error(`Must connected signer or use .Address instead.`);
        }
        return this.Address(this.signer.publicKey.toString());
    };

    public Address = (
        address: string,
    ): SolanaOutputPayload | SolanaInputPayload => {
        return {
            chain: this.chain,
            type: "mintToAddress",
            params: {
                to: address,
            },
        };
    };

    /**
     * Import an existing Solana transaction instead of watching for deposits
     * to a gateway address.
     *
     * @example
     * solana.Transaction({
     *   txHash: "3mabcf8...",
     * })
     */
    public Transaction = (
        partialTx: Partial<ChainTransaction> &
            ({ txid: string } | { txHash: string } | { txidFormatted: string }),
    ): SolanaInputPayload => {
        return {
            chain: this.chain,
            type: "transaction",
            params: {
                tx: populateChainTransaction({
                    partialTx,
                    chain: this.chain,
                    txHashToBytes,
                    txHashFromBytes,
                    defaultTxindex: "0",
                }),
            },
        };
    };

    public BurnNonce = (
        burnNonce: Uint8Array | string | number,
    ): SolanaInputPayload => {
        return {
            chain: this.chain,
            type: "burnNonce",
            params: {
                burnNonce:
                    burnNonce instanceof Uint8Array
                        ? utils.fromBytes(burnNonce).toString()
                        : burnNonce.toString(),
            },
        };
    };
}
