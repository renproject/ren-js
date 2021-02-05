import { Asset, LockAndMintEvent, UTXOWithChain } from "@renproject/interfaces";
import { Loading, TokenIcon } from "@renproject/react-components";
import { extractError } from "@renproject/utils";
import { toLegacyAddress } from "bchaddrjs";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import { lighten } from "polished";
import React from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import styled from "styled-components";

import { ReactComponent as QR } from "../../../scss/images/qr.svg";
import { ClickToCopy } from "../../views/ClickToCopy";
import {
    Container,
    ContainerBody,
    ContainerBottom,
    ContainerButtons,
    ContainerDetails,
    ContainerHeader,
} from "../../views/Container";
import { Mini } from "../../views/Mini";
import { ShowQRCode } from "../../views/ShowQRCode";

const ClickToCopyAddress = styled.div`
    padding: 0 !important;
`;

const StyledLabel = styled.span`
    color: ${(p) => lighten(0.1, p.theme.primaryColor)} !important;
    font-size: 14px !important;
    font-weight: 400 !important;
    letter-spacing: 0.2px;
    display: flex;
    flex: 1;
    margin-top: 3px;
    width: 100%;
    justify-content: center;

    max-width: calc(100% - 50px);
    overflow-x: hidden;
    text-overflow: ellipsis;

    overflow: -moz-scrollbars-none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        /* remove scrollbar space */
        display: none;
        width: 0px;
        height: 0px;
    }
`;

const EllipsisSpan = styled.span`
    font-size: 1px;
    color: #00000000;
    margin-top: 14px;
    max-width: 11px;

    &:after {
        content: "...";
        font-size: 14px;
        display: block;
        margin-top: -14px;
        color: ${(p) => lighten(0.1, p.theme.primaryColor)} !important;
    }
`;

const AddressControls = styled.button`
    display: flex;
    align-items: center;
    /* margin-right: 13px; */
    width: 58px !important;
    flex: 1;
    max-width: 58px;
    justify-content: center;
    height: 100% !important;
    border: none !important;
    border-left: 1px solid #dbe0e8 !important;
    padding: 0;
    padding-right: 5px;
    background: none;
    min-width: unset !important;
    border-top-right-radius: 50px;
    border-bottom-right-radius: 50px;

    &:hover,
    &:active {
        margin-top: 0 !important;
        box-shadow: none !important;
        background: #f9f9f9;
    }

    &:active {
        background: #f5f5f5;
    }

    button + button {
        margin-left: 5px;
    }
`;

const ContinueButton = styled.button`
    background: ${(p) =>
        `linear-gradient(90deg, ${p.theme.primaryColor} 0%, ${lighten(
            0.1,
            p.theme.primaryColor,
        )} 180%)`};
`;

interface Props {
    mini: boolean;
    token: Asset;
    generateAddress: () => Promise<string | undefined>;
    transferParams: LockAndMintEvent["transferParams"];
    utxos: OrderedMap<string, UTXOWithChain>;
    confirmations: number;
    waitForDeposit(onDeposit: (utxo: UTXOWithChain) => void): Promise<void>;
    onDeposit(utxo: UTXOWithChain): void;
}

// Show Deposit Address
export const ShowGatewayAddress: React.FC<Props> = ({
    mini,
    token,
    utxos,
    transferParams,
    confirmations,
    generateAddress,
    waitForDeposit,
    onDeposit,
}) => {
    // Defaults for demo

    const [showQR, setShowQR] = React.useState(false);
    const [understood, setUnderstood] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [showSpinner, setShowSpinner] = React.useState(false);
    const [gatewayAddress, setGatewayAddress] = React.useState<string | null>(
        null,
    );
    // Show BECH32 or legacy BCH addresses.
    const [showLegacyAddress, setShowLegacyAddress] = React.useState(false);
    const [timer, setTimer] = React.useState<NodeJS.Timeout | null>(null);
    const [failed, setFailed] = React.useState<string | null>(null);

    const onQRClick = (
        event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    ) => {
        event.stopPropagation();
        setShowQR(!showQR);
    };

    const revealGatewayAddress = React.useCallback(() => {
        setTimer(
            setTimeout(() => {
                setShowSpinner(true);
            }, 5000) as any, // tslint:disable-line: no-any
        );
        setUnderstood(true);

        (async () => {
            const address = await generateAddress();
            setGatewayAddress(address || "");
            await waitForDeposit(onDeposit);
        })().catch((error) => {
            setFailed(extractError(error));
            setUnderstood(false);
        });
    }, [generateAddress, waitForDeposit, onDeposit]);

    React.useEffect(() => {
        revealGatewayAddress();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onClickAddress = React.useCallback(() => {
        setCopied(true);
        if (timer) {
            clearTimeout(timer);
        }
        setTimer(
            setTimeout(() => {
                setCopied(false);
                if (!showSpinner) {
                    setShowSpinner(true);
                }
            }, 5000) as any, // tslint:disable-line: no-any
        );
    }, [showSpinner, timer]);

    const amount = transferParams.suggestedAmount
        ? new BigNumber(
              BigNumber.isBigNumber(transferParams.suggestedAmount)
                  ? transferParams.suggestedAmount
                  : transferParams.suggestedAmount.toString(),
          )
              .div(new BigNumber(10).exponentiatedBy(8))
              .toFixed()
        : undefined; // TODO: decimals

    const legacyOrNewAddress = React.useMemo(
        () =>
            gatewayAddress && showLegacyAddress
                ? toLegacyAddress(gatewayAddress)
                : gatewayAddress,
        [gatewayAddress, showLegacyAddress],
    );

    if (mini) {
        const last = utxos.last<UTXOWithChain>();
        return (
            <Mini
                token={token}
                message={
                    last
                        ? `${last.utxo.confirmations} / ${confirmations} confirmations`
                        : "Waiting for deposit"
                }
            />
        );
    }

    return (
        <Container>
            <ContainerBody>
                {!showQR ? (
                    <ContainerHeader icon={<TokenIcon token={token} />} />
                ) : null}
                <ContainerDetails>
                    {showQR && legacyOrNewAddress ? (
                        <ShowQRCode
                            address={legacyOrNewAddress}
                            token={token}
                            amount={amount}
                            showLegacyAddress={showLegacyAddress}
                            setShowLegacyAddress={setShowLegacyAddress}
                        />
                    ) : (
                        <>
                            <div className="show-gateway--title">
                                Deposit{" "}
                                {amount ? (
                                    <ClickToCopy amount={amount} />
                                ) : (
                                    <></>
                                )}{" "}
                                {token.toUpperCase()}
                            </div>
                            <div className="show-gateway--subtitle">
                                in a single transaction to
                            </div>
                        </>
                    )}
                </ContainerDetails>
            </ContainerBody>
            <ContainerBottom>
                {understood ? (
                    <>
                        {/* <ScanningBanner>Scanning for transaction</ScanningBanner> */}
                        <CopyToClipboard
                            text={gatewayAddress || ""}
                            onCopy={onClickAddress}
                        >
                            <ClickToCopyAddress
                                role="button"
                                className={`click-to-copy ${
                                    copied ? "click-to-copy--copied" : ""
                                }`}
                            >
                                {legacyOrNewAddress ? (
                                    <>
                                        <StyledLabel>
                                            <>
                                                {legacyOrNewAddress.slice(
                                                    0,
                                                    20,
                                                ) || ""}
                                                {legacyOrNewAddress.slice(
                                                    20,
                                                    legacyOrNewAddress.length -
                                                        20,
                                                ) ? (
                                                    <EllipsisSpan>
                                                        {legacyOrNewAddress.slice(
                                                            20,
                                                            legacyOrNewAddress.length -
                                                                20,
                                                        ) || ""}
                                                    </EllipsisSpan>
                                                ) : (
                                                    <></>
                                                )}
                                                {legacyOrNewAddress.slice(
                                                    Math.max(
                                                        20,
                                                        legacyOrNewAddress.length -
                                                            20,
                                                    ),
                                                ) || ""}
                                            </>
                                        </StyledLabel>
                                        <label className="copied-text">
                                            Copied
                                        </label>
                                        <AddressControls onClick={onQRClick}>
                                            <QR height={16} className="qr" />
                                        </AddressControls>
                                    </>
                                ) : (
                                    <Loading />
                                )}
                            </ClickToCopyAddress>
                        </CopyToClipboard>
                        {/* {showQR ? <div className="qr-code"><QRCode value={`bitcoin:${gatewayAddress}?amount=${amount}`} /></div> : null} */}
                    </>
                ) : (
                    <>
                        {failed ? (
                            <div className="center red">{failed}</div>
                        ) : (
                            <></>
                        )}
                        <ContainerButtons>
                            <ContinueButton
                                className="button"
                                onClick={revealGatewayAddress}
                            >
                                Reveal deposit address
                            </ContinueButton>
                        </ContainerButtons>
                    </>
                )}
            </ContainerBottom>
        </Container>
    );
};
