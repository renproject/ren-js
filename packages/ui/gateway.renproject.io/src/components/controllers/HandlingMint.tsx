import * as React from "react";

import { Asset, LockAndMintStatus } from "@renproject/interfaces";
import { Loading } from "@renproject/react-components";

import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { LogIn } from "../views/LogIn";
import { TransferDetails } from "../views/TransferDetails";
import { Complete } from "./pages/Complete";
import { DepositReceived } from "./pages/DepositReceived";
import { InvalidParameters } from "./pages/InvalidParameters";
import { ShowGatewayAddress } from "./pages/ShowGatewayAddress";
import { SubmitMintToEthereum } from "./pages/SubmitMintToEthereum";

interface Props {
    pressedDone: boolean;
    onDone: () => Promise<void>;
    showNotification: (title: string, body: string) => Promise<null>;
    requestNotificationPermission: () => Promise<{
        error?: string;
    } | null>;
}

/**
 * HandlingMint displays the various steps of a lock-and-mint.
 */
export const HandlingMint: React.FC<Props> = ({ onDone, pressedDone, showNotification, requestNotificationPermission }) => {
    const {
        paused, utxos, wrongNetwork, expectedNetwork,
        deposit,
    } = UIContainer.useContainer();
    const {
        renJS, transfer, generateAddress,
        getNumberOfConfirmations, submitMintToEthereum,
        waitForDeposits,
    } = SDKContainer.useContainer();

    if (!transfer) {
        return <Loading />;
    }

    const token = transfer.transferParams.sendToken.slice(0, 3) as Asset;

    if (!renJS || wrongNetwork) {
        return <>
            <LogIn correctNetwork={expectedNetwork || "correct"} token={token} paused={paused} wrongNetwork={wrongNetwork} />
        </>;
    }

    let inner;
    switch (transfer.status) {
        case LockAndMintStatus.Committed:
            // TODO: Refactor to not use try-catch.
            try {
                // Show the deposit address and wait for a deposit
                inner = <ShowGatewayAddress
                    mini={paused}
                    generateAddress={generateAddress}
                    token={token}
                    utxos={utxos}
                    transferParams={transfer.transferParams}
                    waitForDeposit={waitForDeposits}
                    confirmations={getNumberOfConfirmations()}
                    onDeposit={deposit}

                />;
            } catch (error) {
                inner = <InvalidParameters mini={paused} token={token} />;
            }
            break;
        case LockAndMintStatus.Deposited:
        case LockAndMintStatus.Confirmed:
        case LockAndMintStatus.SubmittedToRenVM:
            try {

                // Show the deposit address and wait for a deposit
                inner = <DepositReceived
                    mini={paused}
                    token={token}
                    utxos={utxos}
                    waitForDeposit={waitForDeposits}
                    confirmations={getNumberOfConfirmations()}
                    onDeposit={deposit}
                    networkDetails={renJS.network}
                    requestNotificationPermission={requestNotificationPermission}
                    showNotification={showNotification}
                />;
            } catch (error) {
                inner = <InvalidParameters mini={paused} token={token} />;
            }
            break;
        case LockAndMintStatus.ReturnedFromRenVM:
        case LockAndMintStatus.SubmittedToEthereum:
            inner = <SubmitMintToEthereum transfer={transfer} networkDetails={renJS.network} mini={paused} txHash={transfer.outTx} submit={submitMintToEthereum} token={token} />;
            break;
        case LockAndMintStatus.ConfirmedOnEthereum:
            inner = <Complete onDone={onDone} pressedDone={pressedDone} token={token} networkDetails={renJS.network} mini={paused} inTx={transfer.inTx} outTx={transfer.outTx} />;
            break;
    }

    return <>
        {inner}
        {!paused ? <TransferDetails transfer={transfer} /> : <></>}
    </>;
};
