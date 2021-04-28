import {
    mintMachine,
    GatewaySession,
    GatewayMachineContext,
    DepositStates,
    GatewayStates,
    buildMintContextWithMap,
    LockChainMap,
    MintChainMap,
    isAccepted,
} from "@renproject/ren-tx";
import RenJS from "@renproject/ren";
import { useActor, useMachine, useSelector } from "@xstate/react";
import {
    DepositCommon,
    LockChain,
    MintChain,
    RenNetwork,
} from "@renproject/interfaces";
import BigNumber from "bignumber.js/bignumber";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BurnSession } from "@renproject/ren-tx/build/main/types/burn";
import { UTXO } from "../../../../lib/chains/chains-bitcoin/build/main/APIs/API";

interface MintParams {
    /**
     * Asset to be minted/burned (on native chain) eg. "BTC"
     */
    sourceAsset: string;
    /**
     * Ren network version to be used, which determines network versions for the selected chains
     */
    network: RenNetwork | "testnet" | "mainnet";
    /**
     * Address that will recieve the asset, eg. "0xA1..."
     */
    destinationAddress: string;
    /**
     * How much the user expects to recieve in destAsset (eg. BTC)
     *
     */
    targetAmount?: string | number;

    /**
     * Amount of sourceAsset user is suggested to send in the base denomination (eg. SATs for Bitcoin)
     * Usually the targetAmount + fees
     */
    suggestedAmount?: string | number;

    /**
     * Optional random 32 bytes to make the gateway address unique. Must be persisted in order to restore the transaction
     */
    nonce?: string | Buffer;
}

export const getSessionDay = () => Math.floor(Date.now() / 1000 / 60 / 60 / 24);

// user has 72 hours from the start of a session day to complete the tx
// a gateway is only valid for 48 hours however.
//
// FIXME: once ren-tx takes the two-stage expiry into account, update this
export const getSessionExpiry = () =>
    (getSessionDay() + 3) * 60 * 60 * 24 * 1000;

export function idFromParams(
    session: GatewaySession<any> | BurnSession<any, any>,
): string {
    return `tx-${session.userAddress}-${getSessionDay()}-${
        session.sourceAsset
    }-to-${session.destChain}`;
}

function sessionFromMintConfigMultiple<X, CustomParams = {}>(config: {
    mintParams: MintParams;
    userAddress: string;
    destinationChain: string;
    sourceChain: string;
    customParams: CustomParams;
}): GatewaySession<X> {
    const session: GatewaySession<X> = {
        ...config.mintParams,
        id: "",
        userAddress: config.userAddress,
        destAddress: config.mintParams.destinationAddress,
        destChain: config.destinationChain,
        sourceChain: config.sourceChain,
        expiryTime: getSessionExpiry(),
        transactions: {},
        customParams: config.customParams,
        createdAt: Date.now(),
    };
    session.id = idFromParams(session);
    return session;
}

export interface MintConfig {
    sdk: RenJS;
    mintParams: MintParams;
    debug?: boolean;
}

// Use this if you want to send to a single destination
export interface MintConfigSingle extends MintConfig {
    to: MintChain;
    from: LockChain;
}

// Use this if you want to set up & restore multiple assets / destinations
export interface MintConfigMultiple<CustomParams = {}> extends MintConfig {
    toMap: MintChainMap<GatewayMachineContext<any>>;
    fromMap: LockChainMap<GatewayMachineContext<any>>;
    /**
     * Chain that the source asset is located on, eg. "Bitcoin"
     */
    sourceChain: string;
    /**
     * Chain that the asset will be recieved on eg. "Ethereum"
     */
    destinationChain: string;
    /**
     * Address that can cryptographically be proven to belong to a user. Used as a "from" address for some chains
     */
    userAddress: string;
    /**
     * Extra parameters to be used for constructing to/from contract parameters
     */
    customParams: CustomParams;
}

function isSingle(
    c: MintConfigSingle | MintConfigMultiple,
): c is MintConfigSingle {
    return (c as MintConfigSingle).to !== undefined;
}

const buildMintContext = <X>(config: MintConfigSingle | MintConfigMultiple) => {
    const { sdk } = config;
    let tx: GatewaySession<X>;

    let fromChainMap = {};
    let toChainMap = {};
    if (isSingle(config)) {
        fromChainMap = { [config.from.name]: (_: any) => config.from };
        toChainMap = { [config.to.name]: (_: any) => config.to };
        tx = sessionFromMintConfigMultiple({
            ...config,
            sourceChain: config.from.name,
            userAddress: "",
            destinationChain: config.to.name,
            customParams: {},
        });
    } else {
        tx = sessionFromMintConfigMultiple(config);
        fromChainMap = config.fromMap;
        toChainMap = config.toMap;
    }
    return buildMintContextWithMap<X>({
        tx,
        sdk,
        fromChainMap,
        toChainMap,
    });
};

export const useLockAndMint = (
    config: MintConfigSingle | MintConfigMultiple,
) => {
    const context = useMemo(() => buildMintContext(config), [config]);

    const [state, , machine] = useMachine(mintMachine, {
        context,
        devTools: config.debug,
    });

    const session = useSelector(machine, (x) => {
        return x.context.tx;
    });

    const addDeposit = useCallback(
        (amount, txHash, vOut) => {
            const rawSourceTx: DepositCommon<UTXO> = {
                amount: String(amount),
                transaction: {
                    amount: String(amount),
                    txHash,
                    vOut,
                    confirmations: 100,
                },
            };
            machine.send({
                type: "RESTORE",
                data: { sourceTxHash: txHash, rawSourceTx },
            });
        },
        [machine.send],
    );

    const [decimals, setDecimals] = useState(0);

    useEffect(() => {
        void (async () => {
            const assetDecimals = await context
                .from(context)
                .assetDecimals(context.tx.sourceAsset);
            setDecimals(assetDecimals);
        })();
    }, [setDecimals, context]);

    const formatAmount = useCallback(
        (amount: string) => {
            return new BigNumber(amount).div(10 ** decimals).toNumber();
        },
        [decimals],
    );

    return {
        addDeposit,
        deposits: Object.keys(state.context.depositMachines || {}),
        formatAmount,
        session,
        sessionMachine: machine,
        state: state.value as GatewayStates,
    };
};

export const useDeposit = (
    session: ReturnType<typeof useLockAndMint>,
    depositId: string,
) => {
    const depositMachine = useSelector(session.sessionMachine, (context) => {
        if (!context.context.depositMachines) return;
        return context.context.depositMachines[depositId];
    });
    if (!depositMachine) return;
    const [state, send] = useActor(depositMachine);

    const mint = useCallback(() => {
        if (!isAccepted(state.context.deposit)) return;
        send({ type: "CLAIM", data: state.context.deposit, params: {} });
    }, [state.context.deposit, send]);

    const [decimals, setDecimals] = useState(0);

    useEffect(() => {
        void (async () => {
            const assetDecimals = await session.sessionMachine.state.context
                .from(session.sessionMachine.state.context)
                .assetDecimals(
                    session.sessionMachine.state.context.tx.sourceAsset,
                );
            setDecimals(assetDecimals);
        })();
    }, [setDecimals, session.sessionMachine.state.context]);

    const formatAmount = useCallback(
        (amount: string) => {
            return new BigNumber(amount).div(10 ** decimals).toNumber();
        },
        [decimals],
    );

    return {
        state,
        formatAmount,
        value: state.value as DepositStates,
        deposit: state.context.deposit,
        mint,
    };
};
