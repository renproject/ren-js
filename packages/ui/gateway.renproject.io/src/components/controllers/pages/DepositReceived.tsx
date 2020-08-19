import { Asset, UTXOWithChain } from "@renproject/interfaces";
import { RenNetworkDetails } from "@renproject/contracts";
import { TokenIcon } from "@renproject/react-components";
import { extractError } from "@renproject/utils";
import { OrderedMap } from "immutable";
import { lighten } from "polished";
import React from "react";
import styled from "styled-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { txPreview, txUrl } from "../../../lib/txUrl";
import { range } from "../../../lib/utils";
import infoIcon from "../../../scss/images/info.svg";
import {
    Container,
    ContainerBody,
    ContainerBottom,
    ContainerDetails,
    ContainerHeader,
} from "../../views/Container";
import { ErrorScreen } from "../../views/ErrorScreen";
import { ExternalLink } from "../../views/ExternalLink";
import { Mini } from "../../views/Mini";
import { ProgressBar } from "../../views/ProgressBar";
import { Tooltip } from "../../views/tooltip/Tooltip";

interface Props {
    mini: boolean;
    token: Asset;
    utxos: OrderedMap<string, UTXOWithChain>;
    networkDetails: RenNetworkDetails;
    confirmations: number;
    waitForDeposit(onDeposit: (utxo: UTXOWithChain) => void): Promise<void>;
    onDeposit(utxo: UTXOWithChain): void;
    requestNotificationPermission(): Promise<{
        error?: string | undefined;
    } | null>;
    showNotification(title: string, body: string): Promise<null>;
}

const ConfirmationsContainer = styled.div`
    text-align: center;
`;

const Title = styled.span`
    font-size: 1.4rem;
    margin-right: 5px;
    color: #3f3f48;
`;

const ConfirmationsBlock = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
`;

const StyledLabel = styled.span`
    color: ${(p) => lighten(0.1, p.theme.primaryColor)} !important;
    font-size: 14px !important;
    font-weight: 400 !important;
    letter-spacing: 0.2px;
`;

export const DepositReceived: React.FC<Props> = ({
    mini,
    token,
    utxos,
    confirmations,
    waitForDeposit,
    onDeposit,
    networkDetails,
    requestNotificationPermission,
    showNotification,
}) => {
    // Defaults for demo

    const [failed, setFailed] = React.useState(null as string | null);

    const waitAndSubmitDeposit = React.useCallback(() => {
        (async () => {
            try {
                requestNotificationPermission().catch(console.error);
                const beforeDeposit = new Date().getTime() / 1000;
                await waitForDeposit(onDeposit);
                const afterDeposit = new Date().getTime() / 1000;

                // Check if waiting for the deposit took longer than 30
                // seconds. This is to avoid showing a notification if the
                // user had the window closed when the TX was confirmed and
                // has just reopened the window.
                const secondsWaited = afterDeposit - beforeDeposit;
                if (secondsWaited >= 30) {
                    // tslint:disable-next-line: insecure-random
                    showNotification(
                        `${token.toUpperCase()} Deposit Confirmed`,
                        `Click to resume transfer`,
                    ).catch(console.error);
                }
            } catch (error) {
                _catchInteractionErr_(
                    error,
                    "Error in DepositReceived: waitAndSubmitDeposit",
                );
                setFailed(extractError(error));
            }
        })().catch(console.error);
    }, [
        waitForDeposit,
        onDeposit,
        requestNotificationPermission,
        showNotification,
        token,
    ]);

    React.useEffect(() => {
        waitAndSubmitDeposit();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tooltipText = `Waiting for ${confirmations} confirmations. This can take up to ${
        networkDetails.isTestnet ? "twenty minutes" : "an hour"
    } due to ${token.toUpperCase()} confirmation times.`;

    const firstUTXO = utxos.first<UTXOWithChain>();

    if (mini) {
        return (
            <Mini
                token={token}
                message={
                    firstUTXO
                        ? firstUTXO.utxo.confirmations >= confirmations
                            ? "Deposit confirmed"
                            : `${firstUTXO.utxo.confirmations} / ${confirmations} confirmations`
                        : "Waiting for deposit"
                }
            />
        );
    }

    // Currently, only the first UTXO is considered.
    utxos = utxos.slice(0, 1);

    if (failed) {
        return (
            <ErrorScreen
                errorTitle={
                    firstUTXO ? (
                        <>
                            Error processing deposit{" "}
                            <ExternalLink
                                className="no-underline"
                                href={txUrl(firstUTXO, networkDetails)}
                            >
                                {txPreview(firstUTXO, 10)}
                            </ExternalLink>
                        </>
                    ) : (
                        <>Error waiting for deposit</>
                    )
                }
                errorMessage={failed}
                retryMessage={<>Retry</>}
                retry={waitAndSubmitDeposit}
            />
        );
    }

    return (
        <Container>
            <ContainerBody>
                <ContainerHeader icon={<TokenIcon token={token} />} />
                <ContainerDetails className="deposit-received">
                    {confirmations ? (
                        <ConfirmationsContainer>
                            <Title>Confirmations</Title>
                            <Tooltip
                                direction={"bottom"}
                                width={250}
                                contents={<span>{tooltipText}</span>}
                            >
                                <img alt={tooltipText} src={infoIcon} />
                            </Tooltip>
                        </ConfirmationsContainer>
                    ) : (
                        <></>
                    )}
                    {utxos
                        .map((utxo) => {
                            return (
                                <div
                                    className="confirmation--progress--container"
                                    key={utxo.utxo.txHash}
                                >
                                    {confirmations ? (
                                        <ConfirmationsBlock>
                                            {confirmations >= 10 ? (
                                                <ProgressBar
                                                    className="confirmation--progress"
                                                    style={{
                                                        width: `${
                                                            confirmations <= 1
                                                                ? 50
                                                                : 100
                                                        }%`,
                                                    }}
                                                    items={[
                                                        ...range(
                                                            Math.ceil(
                                                                confirmations /
                                                                    2,
                                                            ),
                                                        ).map((i) => ({
                                                            label: String(
                                                                i * 2 + 1,
                                                            ),
                                                        })),
                                                        { label: "✓" },
                                                    ]}
                                                    progress={
                                                        utxo.utxo
                                                            .confirmations / 2
                                                    }
                                                    pulse={true}
                                                />
                                            ) : (
                                                <ProgressBar
                                                    className="confirmation--progress"
                                                    style={{
                                                        width: `${
                                                            confirmations <= 1
                                                                ? 50
                                                                : 100
                                                        }%`,
                                                    }}
                                                    items={[
                                                        ...range(
                                                            confirmations,
                                                        ).map((_) => ({})),
                                                        { label: "✓" },
                                                    ]}
                                                    progress={
                                                        utxo.utxo.confirmations
                                                    }
                                                    pulse={true}
                                                />
                                            )}
                                        </ConfirmationsBlock>
                                    ) : (
                                        <></>
                                    )}
                                </div>
                            );
                        })
                        .valueSeq()}
                </ContainerDetails>
            </ContainerBody>
            <ContainerBottom>
                {utxos
                    .map((utxo) => {
                        return (
                            <div key={utxo.utxo.txHash}>
                                <ExternalLink
                                    className="no-underline"
                                    href={txUrl(utxo, networkDetails)}
                                >
                                    <div
                                        role="button"
                                        className={`click-to-copy`}
                                    >
                                        <StyledLabel>
                                            Tx ID: {txPreview(utxo)}
                                        </StyledLabel>
                                    </div>
                                </ExternalLink>
                            </div>
                        );
                    })
                    .valueSeq()}
            </ContainerBottom>
        </Container>
    );
};
