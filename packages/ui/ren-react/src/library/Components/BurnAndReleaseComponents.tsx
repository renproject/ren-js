import * as React from "react";
import {
    BurnSession,
    BurnStates,
    BurnTransaction,
    isBurnConfirmed,
    isBurnErroring,
    isReleased,
} from "@renproject/ren-tx";
import {
    BurnConfigMultiple,
    BurnConfigSingle,
    useBurnAndRelease,
} from "../useBurnAndRelease";

export interface ConfirmingBurnProps {
    tx: BurnTransaction;
    confirmations: number;
    targetConfirmations?: number;
}

const DefaultConfirmingBurn: React.FC<ConfirmingBurnProps> = ({
    confirmations,
    targetConfirmations,
}) => {
    return (
        <div className="confirmingBurn">
            Waiting for burn confirmation {confirmations}/
            {targetConfirmations || "?"}
        </div>
    );
};

interface CreatingBurnProps {
    session: BurnSession<any, any>;
}

const DefaultCreatingBurn: React.FC<CreatingBurnProps> = () => {
    return <div className="creating">Creating Burn...</div>;
};

interface CreatedBurnProps {
    session: BurnSession<any, any>;
    burn: () => void;
    amount: number;
    asset: string;
}

const DefaultCreatedBurn: React.FC<CreatedBurnProps> = ({
    burn,
    amount,
    asset,
}) => {
    return (
        <div className="created-burn">
            <button onClick={burn}>
                Burn {amount} {asset}?
            </button>
        </div>
    );
};

interface SubmittingBurnProps {
    session: BurnSession<any, any>;
}

const DefaultSubmittingBurn: React.FC<SubmittingBurnProps> = () => {
    return (
        <div className="submitting-burn">
            Please submit transaction in your wallet
        </div>
    );
};

interface AcceptedBurnProps {
    tx: BurnTransaction;
    amount: number;
}

const DefaultAcceptedBurn: React.FC<AcceptedBurnProps> = ({ amount }) => {
    return <div className="acceptedBurn">Burned {amount}</div>;
};

interface CompletedBurnProps {
    tx: BurnTransaction;
    amount: number;
    txHash: string;
}

const DefaultCompletedBurn: React.FC<CompletedBurnProps> = ({
    amount,
    txHash,
}) => {
    return (
        <div className="completed-burn">
            Successfully burned {amount}{" "}
            {txHash ? ` in release tx: ${txHash}` : ""}
        </div>
    );
};

interface ReleasingBurnProps {
    tx: BurnTransaction;
}

const DefaultReleasingBurn: React.FC<ReleasingBurnProps> = ({}) => {
    return <div className="loading-burn">Releasing from RenVM...</div>;
};

interface ErrorReleasingProps {
    tx: BurnTransaction;
    reason: Error;
}

const DefaultErrorReleasing: React.FC<ErrorReleasingProps> = ({ reason }) => {
    return (
        <div className="error-releasing-burn">
            Error Releasing {reason.message}
        </div>
    );
};

interface ErrorBurningProps {
    session: BurnSession<any, any>;
    reason: Error;
}

const DefaultErrorBurning: React.FC<ErrorBurningProps> = ({ reason }) => {
    return <div className="error-burning">Error Burning {reason.message}</div>;
};

export interface BurnProps {
    parameters: BurnConfigSingle | BurnConfigMultiple;
    ConfirmingBurn?: React.FC<ConfirmingBurnProps>;
    CreatingBurn?: React.FC<CreatingBurnProps>;
    CreatedBurn?: React.FC<CreatedBurnProps>;
    AcceptedBurn?: React.FC<AcceptedBurnProps>;
    SubmittingBurn?: React.FC<SubmittingBurnProps>;
    CompletedBurn?: React.FC<CompletedBurnProps>;
    ReleasingBurn?: React.FC<ReleasingBurnProps>;
    ErrorBurning?: React.FC<ErrorBurningProps>;
    ErrorReleasing?: React.FC<ErrorReleasingProps>;
    BurnInfo?: React.FC<BurnInfoProps>;
}

interface BurnInfoProps {
    session: BurnSession<any, any>;
    amount: number;
}

const DefaultBurnInfo: React.FC<BurnInfoProps> = ({ session, amount }) => {
    return (
        <div>
            Burning {amount}
            {session.sourceAsset} to {session.destAddress}
        </div>
    );
};

export const BasicBurn: React.FC<BurnProps> = ({
    parameters,
    ConfirmingBurn = DefaultConfirmingBurn,
    CreatingBurn = DefaultCreatingBurn,
    CreatedBurn = DefaultCreatedBurn,
    SubmittingBurn = DefaultSubmittingBurn,
    ReleasingBurn = DefaultReleasingBurn,
    AcceptedBurn = DefaultAcceptedBurn,
    CompletedBurn = DefaultCompletedBurn,
    BurnInfo = DefaultBurnInfo,
    ErrorBurning = DefaultErrorBurning,
    ErrorReleasing = DefaultErrorReleasing,
}) => {
    const machine = useBurnAndRelease(parameters);
    if (!machine) return <div>Missing burn...</div>;
    const { burn, value, tx, session, formatAmount } = machine;
    switch (value) {
        case BurnStates.CREATING:
            return <CreatingBurn session={session} />;
        case BurnStates.CREATED:
            return (
                <CreatedBurn
                    session={session}
                    asset={session.sourceAsset}
                    amount={formatAmount(session.targetAmount)}
                    burn={burn}
                />
            );
        case BurnStates.SUBMITTING_BURN:
            return <SubmittingBurn session={session} />;
        case BurnStates.CONFIRMING_BURN:
            if (!tx) throw new Error("invalid state");
            return (
                <ConfirmingBurn
                    tx={tx}
                    targetConfirmations={tx.sourceTxConfTarget}
                    confirmations={tx.sourceTxConfs || 0}
                />
            );
        case BurnStates.RENVM_RELEASING:
            if (!tx || !isBurnConfirmed(tx)) throw new Error("invalid state");
            return <ReleasingBurn tx={tx} />;
        case BurnStates.RENVM_ACCEPTED:
            if (!tx || !isBurnConfirmed(tx)) throw new Error("invalid state");
            return (
                <AcceptedBurn
                    tx={tx}
                    amount={formatAmount(tx.sourceTxAmount)}
                />
            );
        case BurnStates.RELEASED:
            if (!tx || !isReleased(tx))
                throw new Error("invalid state " + JSON.stringify(tx));
            return (
                <CompletedBurn
                    tx={tx}
                    amount={formatAmount(
                        (tx.renResponse?.out as any)?.amount ||
                            tx.sourceTxAmount,
                    )}
                    txHash={tx.destTxHash || ""}
                />
            );
        case BurnStates.ERROR_BURNING:
            if (!isBurnErroring(session)) throw new Error("");
            return (
                <ErrorBurning
                    session={session}
                    reason={session.error || new Error("unknown")}
                />
            );
        case BurnStates.ERROR_RELEASING:
            if (!tx) throw new Error("invalid state");
            return (
                <ErrorReleasing
                    tx={tx}
                    reason={tx.error || new Error("unknown")}
                />
            );
        default:
            return (
                <BurnInfo
                    amount={formatAmount(session.targetAmount)}
                    session={session}
                />
            );
    }
};
