import { Asset, LockAndMintStatus } from "@renproject/interfaces";
import { Loading } from "@renproject/react-components";
import React from "react";

import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { LogIn } from "../views/LogIn";
import { Complete } from "./pages/Complete";
import { DepositReceived } from "./pages/DepositReceived";
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
export const HandlingMint: React.FC<Props> = ({
    onDone, pressedDone, showNotification, requestNotificationPermission,
}) => {
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
        return <LogIn
            correctNetwork={expectedNetwork || "correct"}
            token={token}
            paused={paused}
            wrongNetwork={wrongNetwork}
        />;
    }

    switch (transfer.status) {
        case LockAndMintStatus.Committed:
            // Show the deposit address and wait for a deposit
            return <ShowGatewayAddress
                mini={paused}
                generateAddress={generateAddress}
                token={token}
                utxos={utxos}
                transferParams={transfer.transferParams}
                waitForDeposit={waitForDeposits}
                confirmations={getNumberOfConfirmations()}
                onDeposit={deposit}

            />;
        case LockAndMintStatus.Deposited:
        case LockAndMintStatus.Confirmed:
        case LockAndMintStatus.SubmittedToRenVM:
            // Show the deposit address and wait for a deposit
            return <DepositReceived
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
        case LockAndMintStatus.ReturnedFromRenVM:
        case LockAndMintStatus.SubmittedToEthereum:
            return <SubmitMintToEthereum
                transfer={transfer}
                networkDetails={renJS.network}
                mini={paused}
                txHash={transfer.outTx}
                submit={submitMintToEthereum}
                token={token}
            />;
        case LockAndMintStatus.ConfirmedOnEthereum:
            return <Complete
                onDone={onDone}
                pressedDone={pressedDone}
                token={token}
                networkDetails={renJS.network}
                mini={paused}
                inTx={transfer.inTx}
                outTx={transfer.outTx}
            />;
    }
    return <></>;
};
