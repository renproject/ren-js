import * as React from "react";

import { Loading, TokenIcon } from "@renproject/react-components";
import RenJS, { UTXO } from "@renproject/ren";
import { OrderedMap } from "immutable";
import CopyToClipboard from "react-copy-to-clipboard";

import { ShiftInEvent, Token, Tx } from "../../../state/generalTypes";
import { network } from "../../../state/sdkContainer";
import { ReactComponent as Copy } from "../../../styles/images/copy.svg";
import { ReactComponent as QR } from "../../../styles/images/qr.svg";
import { Popup } from "../Popup";
import styled from "styled-components";
import { theme } from "../../../theme";

export const txUrl = (tx: Tx | null): string => {
    if (!tx) { return ""; }
    const isTx = tx.hash && tx.hash.slice && tx.hash.match(/(0x)?[a-fA-F0-9]+/);
    switch (tx.chain) {
        case RenJS.Chains.Ethereum:
            return `${network.contracts.etherscan}/tx/${tx.hash}`;
        case RenJS.Chains.Bitcoin:
            return `https://chain.so/${isTx ? "tx" : "address"}/BTC${network.isTestnet ? "TEST" : ""}/${RenJS.utils.strip0x(tx.hash)}`;
        case RenJS.Chains.Zcash:
            return `https://chain.so/${isTx ? "tx" : "address"}/ZEC${network.isTestnet ? "TEST" : ""}/${RenJS.utils.strip0x(tx.hash)}`;
        case RenJS.Chains.BitcoinCash:
            return `https://explorer.bitcoin.com/${network.isTestnet ? "t" : ""}bch/${isTx ? "tx" : "address"}/${RenJS.utils.strip0x(tx.hash)}`;
        default:
            throw new Error(`Unsupported chain ${tx.chain}`);
    }
};

const ScanningBanner: React.FC<{}> = props => {
    const ScanningDot = styled.span`
            height: 15px;
            width: 15px;
            background-color: ${theme.primaryColor.lighten(0.2)};
            border-radius: 50%;
            display: inline-block;
            border: solid 3px ${theme.primaryColor.lighten(0.9)};
            margin-right: 5px;
        `;

    const ScanningDiv = styled.div`
            font-size: 13.44px;
            color: ${theme.lightGrey};
            display: flex;
            justify-content: center;
            padding: 40px 0;
        `;

    const ScanningText = styled.span`
            min-width: 170px;
        `;
    return (
        <ScanningDiv><ScanningDot /><ScanningText className="ellipsis">{props.children}</ScanningText></ScanningDiv>
    );
};

const INTEROP_LINK = "#";

interface Props {
    mini: boolean;
    token: Token;
    amount: string;
    orderID: string;
    depositAddress: string;
    order: ShiftInEvent;
    onQRClick(): void;
    waitForDeposit(orderID: string, onDeposit: (utxo: UTXO) => void): Promise<void>;
}

export const ShowDepositAddress: React.StatelessComponent<Props> =
    ({ mini, amount, token, orderID, order, depositAddress, onQRClick, waitForDeposit }) => {
        // Defaults for demo

        // tslint:disable-next-line: prefer-const
        let [understood, setUnderstood] = React.useState(false);
        const [copied, setCopied] = React.useState(false);
        const [utxos, setUTXOs] = React.useState(OrderedMap<string, UTXO>());

        const [showSpinner, setShowSpinner] = React.useState(false);

        const [timer, setTimer] = React.useState<NodeJS.Timeout | null>(null);
        const [failed, setFailed] = React.useState(null as Error | null);

        // useEffect replaces `componentDidMount` and `componentDidUpdate`.
        // To limit it to running once, we use the initialized hook.
        const [initialized, setInitialized] = React.useState(false);

        const onDeposit = (deposit: UTXO) => {
            setUTXOs(utxos.set(deposit.utxo.txid, deposit));
        };

        const showDepositAddress = () => {
            // @ts-ignore
            setTimer(setTimeout(() => {
                setShowSpinner(true);
            }, 5000)
            );
            setUnderstood(true);
            understood = true;
            waitForDeposit(orderID, onDeposit)
                .catch(() => {
                    setUnderstood(false);
                    understood = false;
                });
        };

        const onClickAddress = () => {
            setCopied(true);
            if (timer) {
                clearTimeout(timer);
            }
            // @ts-ignore
            setTimer(setTimeout(() => {
                setCopied(false);
                if (!showSpinner) {
                    setShowSpinner(true);
                }
            }, 5000)
            );
        };

        const ContinueButton = styled.button`
            background: linear-gradient(90deg, ${theme.primaryColor} 0%, ${theme.primaryColor.lighten(0.5)} 180%)
        `;

        const DepositLabel = styled.label`
        position: absolute;
        top: 0;
        width: 200px;
        text-align: center;
        margin-left: 100px;
        font-size: 14px;
        color: ${theme.lightGrey};
        background-color: white;
        margin-top: -10px;
        `;

        const StyledInput = styled.input`
        color: ${theme.primaryColor.lighten(0.2)} !important;
        font-size: 14px !important;
        font-weight: 400 !important;
        `;


        const showAddress = understood ?
            <>
                <ScanningBanner>Scanning for transaction</ScanningBanner>
                <CopyToClipboard
                    text={depositAddress || ""}
                    onCopy={onClickAddress}
                >
                    <div role="button" className={`address-input--copy ${copied || true ? "address-input--copied" : ""}`}>
                        <StyledInput
                            type="text"
                            name="address"
                            disabled={true}
                            value={depositAddress || ""}
                            autoFocus={true}
                            required={true}
                            aria-required={true}
                        />
                        <DepositLabel>Bitcoin Deposit Address</DepositLabel>
                        <QR className="qr" onClick={onQRClick} />
                        <Copy />
                    </div>
                </CopyToClipboard>
                {/* {showQR ? <div className="qr-code"><QRCode value={`bitcoin:${depositAddress}?amount=${amount}`} /></div> : null} */}
            </> :
            <>
                {failed ? <div className="red">{`${failed.message || failed}`}</div> :
                    <div className="popup--body--box">
                        <div className="popup--body--box--title">
                            Transfer {token.toUpperCase()} trustlessly.
                        </div>
                        Your {token.toUpperCase()} will be bridged to Ethereum in a completely trustless and decentralized way. Read more about RenVM and sMPC <a href="#">here</a>.
                    </div>
                }
                <div className="popup--buttons">
                    <ContinueButton className="button" disabled={depositAddress === null || failed !== null} onClick={showDepositAddress}>{failed ? "Unable to generate address" : "Continue"}</ContinueButton>
                </div>
            </>;

        const showUTXOs = (
            utxos.size > 0 ? <div className="show-utxos">
                <p>Waiting for confirmations. This can take up to twenty minutes due to confirmation times on various blockchains. This will be improved for Mainnet via 3rd parties. For more information, head <a className="blue" href={INTEROP_LINK} target="_blank" rel="noopener noreferrer">here</a>.</p>
                {utxos.map(utxo => {
                    return <div key={utxo.utxo.txid} className="show-utxos--utxo">
                        <a href={txUrl({ chain: utxo.chain, hash: utxo.utxo.txid })} target="_blank" rel="noopener noreferrer">TXID {utxo.utxo.txid.slice(0, 12)}...{utxo.utxo.txid.slice(-5, -1)}</a>
                        <span>{utxo.utxo.confirmations} / {order ? (2) : "?"} confirmations</span>
                        <Loading className="loading--blue" />
                    </div>;
                }).valueSeq()}
                {/* <details>
                    <summary>Show deposit address</summary>
                    {showAddress}
                </details> */}
            </div> : null
        );

        if (mini) {
            const last = utxos.last<UTXO>();
            return <Popup mini={mini}>
                <div className="side-strip"><TokenIcon token={token} /></div>
                <div className="popup--body--details">
                    {last ? <>{last.utxo.confirmations} / 2 confirmations</> : <>Waiting for deposit</>}
                </div>
            </Popup>;
        }

        return <Popup mini={mini}>
            <div className="deposit-address">
                <div className="popup--body--actions">
                    {utxos.size > 0 ? showUTXOs : showAddress}
                </div>
            </div>
        </Popup>;
    };
