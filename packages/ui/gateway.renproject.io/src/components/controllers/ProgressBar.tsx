import * as React from "react";

import { ShiftInStatus, ShiftOutStatus } from "@renproject/ren-js-common";

import infoIcon from "../../images/icons/info.svg";
import { connect, ConnectedProps } from "../../state/connect";
import { SDKContainer } from "../../state/sdkContainer";
import { Tooltip } from "../views/tooltip/Tooltip";

interface Props extends ConnectedProps<[SDKContainer]> {
}

const ProgressItem = ({ name, label, target, progress, tooltip }: { name: React.ReactChild, label: string | number, target: number, progress: number, tooltip?: string }) =>
    <div className={`shift-progress--item ${progress >= target ? "shift-progress--item--done" : ""}`}>
        <div className="shift-progress--number">{label}</div>
        <div className="shift-progress--label">{name} {tooltip ? <Tooltip contents={tooltip}><img alt={`Tooltip: ${tooltip}`} src={infoIcon} /></Tooltip> : null}</div>
    </div>;

const statusToProgress = (status: ShiftInStatus | ShiftOutStatus) => {
    switch (status) {
        // Shift in
        case ShiftInStatus.Committed: return 1;
        case ShiftInStatus.Deposited: return 2;
        case ShiftInStatus.Confirmed: return 2;
        case ShiftInStatus.SubmittedToRenVM: return 2;
        case ShiftInStatus.ReturnedFromRenVM: return 3;
        case ShiftInStatus.SubmittedToEthereum: return 3;
        case ShiftInStatus.ConfirmedOnEthereum: return 4;

        // Shift out
        case ShiftOutStatus.Committed: return 1;
        case ShiftOutStatus.SubmittedToEthereum: return 1;
        case ShiftOutStatus.ConfirmedOnEthereum: return 2;
        case ShiftOutStatus.NoBurnFound: return 2;
        case ShiftOutStatus.SubmittedToRenVM: return 2;
        case ShiftOutStatus.ReturnedFromRenVM: return 3;
    }
};

export const ProgressBar = connect<Props & ConnectedProps<[SDKContainer]>>([SDKContainer])(
    ({ containers: [sdkContainer] }) => {

        const { shift } = sdkContainer.state;

        const progress = shift ? statusToProgress(shift.status) : 0;

        return <div className="shift-progress">
            {shift ?
                shift.shiftParams.sendToken.slice(4, 7).toLowerCase() === "eth" ?
                    <>
                        {/* Shift out */}
                        <ProgressItem target={1} label={1} progress={progress} name={"MetaMask"} />
                        <ProgressItem target={2} label={2} progress={progress} name={"RenVM"} />
                        <ProgressItem target={3} label={3} progress={progress} name={"Complete"} />
                    </> : <>
                        {/* Shift in */}
                        <ProgressItem target={1} label={1} progress={progress} name={"Deposit"} />
                        <ProgressItem target={2} label={2} progress={progress} name={"Confirmations"} tooltip="RenVM waits for 2 confirmations for BTC/BCH and 6 confirmations for ZEC" />
                        <ProgressItem target={3} label={3} progress={progress} name={"MetaMask"} />
                        <ProgressItem target={4} label={4} progress={progress} name={"Complete"} />
                    </>
                :
                <></>
            }
        </div>;
    }
);
