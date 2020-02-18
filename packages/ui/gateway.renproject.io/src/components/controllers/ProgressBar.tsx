import * as React from "react";

import { ShiftInStatus, ShiftOutStatus } from "@renproject/ren-js-common";

import infoIcon from "../../images/icons/info.svg";
import { connect, ConnectedProps } from "../../state/connect";
import { SDKContainer } from "../../state/sdkContainer";
import { ProgressBar } from "../views/ProgressBar";
import { Tooltip } from "../views/tooltip/Tooltip";

interface Props extends ConnectedProps<[SDKContainer]> {
}

export const ProgressItem = ({ name, label, target, progress, tooltip }: { name?: React.ReactChild, label?: string | number, target: number, progress: number, tooltip?: string }) =>
    <div className={`shift-progress--item ${progress >= target ? "shift-progress--item--done" : ""}`}>
        <div className="shift-progress--number">{label || target}</div>
        {name ? <div className="shift-progress--label">{name} {tooltip ? <Tooltip contents={tooltip}><img alt={`Tooltip: ${tooltip}`} src={infoIcon} /></Tooltip> : null}</div> : <></>}
    </div>;

const statusToProgress = (status: ShiftInStatus | ShiftOutStatus) => {
    switch (status) {
        // Shift in
        case ShiftInStatus.Committed: return 0;
        case ShiftInStatus.Deposited: return 1;
        case ShiftInStatus.Confirmed: return 1;
        case ShiftInStatus.SubmittedToRenVM: return 1;
        case ShiftInStatus.ReturnedFromRenVM: return 2;
        case ShiftInStatus.SubmittedToEthereum: return 2;
        case ShiftInStatus.ConfirmedOnEthereum: return 3;

        // Shift out
        case ShiftOutStatus.Committed: return 0;
        case ShiftOutStatus.SubmittedToEthereum: return 0;
        case ShiftOutStatus.ConfirmedOnEthereum: return 1;
        case ShiftOutStatus.NoBurnFound: return 1;
        case ShiftOutStatus.SubmittedToRenVM: return 1;
        case ShiftOutStatus.ReturnedFromRenVM: return 2;
    }
};

export const ShiftProgress = connect<Props & ConnectedProps<[SDKContainer]>>([SDKContainer])(
    ({ containers: [sdkContainer] }) => {

        const { shift } = sdkContainer.state;

        const progress = shift ? statusToProgress(shift.status) : 0;

        return shift ?
            shift.shiftParams.sendToken.slice(4, 7).toLowerCase() === "eth" ?
                <ProgressBar
                    className="shift-progress"
                    items={[
                        { name: "MetaMask" },
                        { name: "RenVM" },
                        { name: "Complete" },
                    ]}
                    progress={progress}
                />
                :
                <ProgressBar
                    className="shift-progress"
                    items={[
                        { name: "Deposit" },
                        { name: "Confirmations", tooltip: "RenVM waits for 2 confirmations for BTC/BCH and 6 confirmations for ZEC" },
                        { name: "MetaMask" },
                        { name: "Complete" },
                    ]}
                    progress={progress}
                />
            :
            <></>;
    }
);
