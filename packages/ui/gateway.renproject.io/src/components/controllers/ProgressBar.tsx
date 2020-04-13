import * as React from "react";

import { BurnAndReleaseStatus, LockAndMintStatus } from "@renproject/interfaces";

import infoIcon from "../../images/icons/info.svg";
import { connect, ConnectedProps } from "../../state/connect";
import { SDKContainer } from "../../state/sdkContainer";
import { ProgressBar } from "../views/ProgressBar";
import { Tooltip } from "../views/tooltip/Tooltip";

interface Props extends ConnectedProps<[SDKContainer]> {
}

export const ProgressItem = ({ name, label, target, progress, tooltip }: { name?: React.ReactChild, label?: string | number, target: number, progress: number, tooltip?: string }) =>
    <div className={`transfer-progress--item ${progress >= target ? "transfer-progress--item--done" : ""}`}>
        <div className="transfer-progress--number">{label || target}</div>
        {name ? <div className="transfer-progress--label">{name} {tooltip ? <Tooltip contents={tooltip}><img alt={`Tooltip: ${tooltip}`} src={infoIcon} /></Tooltip> : null}</div> : <></>}
    </div>;

const statusToProgress = (status: LockAndMintStatus | BurnAndReleaseStatus) => {
    switch (status) {
        // LockAndMint
        case LockAndMintStatus.Committed: return 0;
        case LockAndMintStatus.Deposited: return 1;
        case LockAndMintStatus.Confirmed: return 1;
        case LockAndMintStatus.SubmittedToRenVM: return 1;
        case LockAndMintStatus.ReturnedFromRenVM: return 2;
        case LockAndMintStatus.SubmittedToEthereum: return 2;
        case LockAndMintStatus.ConfirmedOnEthereum: return 3;

        // BurnAndRelease
        case BurnAndReleaseStatus.Committed: return 0;
        case BurnAndReleaseStatus.SubmittedToEthereum: return 0;
        case BurnAndReleaseStatus.ConfirmedOnEthereum: return 1;
        case BurnAndReleaseStatus.NoBurnFound: return 1;
        case BurnAndReleaseStatus.SubmittedToRenVM: return 1;
        case BurnAndReleaseStatus.ReturnedFromRenVM: return 2;
    }
};

export const TransferProgress = connect<Props & ConnectedProps<[SDKContainer]>>([SDKContainer])(
    ({ containers: [sdkContainer] }) => {

        const { transfer } = sdkContainer.state;

        const progress = transfer ? statusToProgress(transfer.status) : 0;

        return transfer ?
            transfer.transferParams.sendToken.slice(4, 7).toLowerCase() === "eth" ?
                <ProgressBar
                    className="transfer-progress"
                    items={[
                        { name: "Ethereum" },
                        { name: "RenVM" },
                        { name: "Complete" },
                    ]}
                    progress={progress}
                />
                :
                <ProgressBar
                    className="transfer-progress"
                    items={[
                        { name: "Deposit" },
                        { name: "Confirmations", tooltip: "RenVM waits for 2 confirmations for BTC/BCH and 6 confirmations for ZEC" },
                        { name: "Ethereum" },
                        { name: "Complete" },
                    ]}
                    progress={progress}
                />
            :
            <></>;
    }
);
