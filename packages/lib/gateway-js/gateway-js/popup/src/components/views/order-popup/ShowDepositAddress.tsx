import * as React from "react";

import { Loading, TokenIcon } from "@renproject/react-components";
import { Chain, strip0x, UTXO } from "@renproject/ren";
import { OrderedMap } from "immutable";
import QRCode from "qrcode.react";
import CopyToClipboard from "react-copy-to-clipboard";

import { ShiftInEvent, Token, Tx } from "../../../state/generalTypes";
import { network } from "../../../state/sdkContainer";
import { ReactComponent as Arrow } from "../../../styles/images/arrow-right.svg";
import { ReactComponent as Copy } from "../../../styles/images/copy.svg";
import { ReactComponent as QR } from "../../../styles/images/qr.svg";
import { Popup } from "../Popup";

export const txUrl = (tx: Tx | null): string => {
    if (!tx) { return ""; }
    const isTx = tx.hash && tx.hash.slice && tx.hash.match(/(0x)?[a-fA-F0-9]+/);
    switch (tx.chain) {
        case Chain.Ethereum:
            return `${network.contracts.etherscan}/tx/${tx.hash}`;
        case Chain.Bitcoin:
            return `https://chain.so/${isTx ? "tx" : "address"}/BTC${network.isTestnet ? "TEST" : ""}/${strip0x(tx.hash)}`;
        case Chain.Zcash:
            return `https://chain.so/${isTx ? "tx" : "address"}/ZEC${network.isTestnet ? "TEST" : ""}/${strip0x(tx.hash)}`;
        case Chain.BCash:
            return `https://explorer.bitcoin.com/${network.isTestnet ? "t" : ""}bch/${isTx ? "tx" : "address"}/${strip0x(tx.hash)}`;
    }
};


const INTEROP_LINK = "#";

interface Props {
    token: Token;
    amount: string;
    orderID: string;
    order: ShiftInEvent;
    cancel(): void;
    generateAddress(orderID: string): string | undefined;
    waitForDeposit(orderID: string, onDeposit: (utxo: UTXO) => void): Promise<void>;
}

export const ShowDepositAddress: React.StatelessComponent<Props> =
    ({ amount, token, orderID, order, cancel, generateAddress, waitForDeposit }) => {
        // Defaults for demo

        // tslint:disable-next-line: prefer-const
        let [understood, setUnderstood] = React.useState(false);
        const [copied, setCopied] = React.useState(false);
        const [showQR, setShowQR] = React.useState(false);
        const [depositAddress, setDepositAddress] = React.useState<string | undefined>(undefined);
        const [utxos, setUTXOs] = React.useState(OrderedMap<string, UTXO>());

        const [showSpinner, setShowSpinner] = React.useState(false);

        const [timer, setTimer] = React.useState<NodeJS.Timeout | null>(null);
        const [failed, setFailed] = React.useState(null as Error | null);

        // useEffect replaces `componentDidMount` and `componentDidUpdate`.
        // To limit it to running once, we use the initialized hook.
        const [initialized, setInitialized] = React.useState(false);
        React.useEffect(() => {
            if (!initialized) {
                try {
                    setDepositAddress(generateAddress(orderID));
                } catch (error) {
                    setFailed(error);
                }
                setInitialized(true);
            }
        }, [initialized, generateAddress, orderID]);

        const onDeposit = (deposit: UTXO) => {
            setUTXOs(utxos.set(deposit.utxo.txid, deposit));
        };

        const showDepositAddress = () => {
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
            setTimer(setTimeout(() => {
                setCopied(false);
                if (!showSpinner) {
                    setShowSpinner(true);
                }
            }, 5000)
            );
        };

        const toggleQR = () => {
            setShowQR(!showQR);
        };

        const showAddress = understood ?
            <>
                <div className="address-input--message">
                    <p>Only send the <b>exact</b> amount of {token.toUpperCase()} in a single transaction or funds will be lost. Future versions will allow sending any amount.</p>
                </div>
                <div className="address-input--label">
                    Send {amount} {token.toUpperCase()} to:
                            </div>
                <CopyToClipboard
                    text={depositAddress || ""}
                    onCopy={onClickAddress}
                >
                    <div role="button" className={`address-input--copy ${copied ? "address-input--copied" : ""}`}>
                        <input
                            type="text"
                            name="address"
                            disabled={true}
                            value={depositAddress || ""}
                            autoFocus={true}
                            required={true}
                            aria-required={true}
                        />
                        <label className="copied-text">Copied</label>
                        <QR className="qr" onClick={toggleQR} />
                        <Copy />
                    </div>
                </CopyToClipboard>
                {showQR ? <QRCode value={`bitcoin:${depositAddress}?amount=${amount}`} /> : null}
                {showSpinner ? <div className="spinner">
                    <Loading />{" "}<span>Scanning for {token.toUpperCase()} deposits</span>
                </div> : null}
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
                    <button className="button open--confirm" disabled={depositAddress === null || failed !== null} onClick={showDepositAddress}>{failed ? "Unable to generate address" : "Continue"}</button>
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

        return <Popup cancel={cancel}>
            <div className="deposit-address">
                <div className="popup--body--actions">
                    {utxos.size > 0 ? showUTXOs : showAddress}
                </div>
            </div>
        </Popup>;
    };
