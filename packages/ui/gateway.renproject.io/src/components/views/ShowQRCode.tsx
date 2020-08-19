import { Asset } from "@renproject/interfaces";
import { toLegacyAddress } from "bchaddrjs";
import QRCode from "qrcode.react";
import React, { useCallback, useState } from "react";
import styled from "styled-components";

import { ReactComponent as CogIcon } from "../../scss/images/cog.svg";

const QRCodeContainer = styled.div`
    background: #FFFFFF;
    border: 1px solid #DBE0E8;
    border-radius: 6px;
    display: inline-flex;
    padding: 10px;

    size: 110px;
    width: 132px;
    height: 132px;

    >canvas {
        height: 110px !important;
        width: 110px !important;
    }
`;

const QRCodeOuter = styled.div`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    width: 100%;

    >span {
        font-size: 1.4rem;
        color: #3F3F48;
        margin-top: 16px;
    }
`;

const QRCodeOptionsOuter = styled.div`
    display: flex;
    flex-flow: column;

    width: calc(50% - 76px);
    margin-right: 10px;

    align-items: flex-start;

    svg {
        width: 15px;
        height: 15px;
    }
`;

const QRCodeOptions = styled.div`
    margin-top: 5px;
    background: #FFFFFF;
    border: 1px solid #DBE0E8;
    border-radius: 6px;

    width: 100%;

    padding: 5px;

    text-align: left;

    h4 {
        font-size: 1.4rem;
        margin-bottom: 1rem;
    }
`;

const QRCodeToggle = styled.div`
    cursor: pointer;
`;

const useToggle = (defaultState: boolean): [boolean, () => void, (value: boolean) => void] => {
    const [state, setState] = useState(defaultState);
    const toggleState = useCallback(() => { setState(!state); }, [state, setState]);
    return [state, toggleState, setState];
};

const useCheckbox = (defaultState: boolean): [boolean, (event: React.ChangeEvent<HTMLInputElement>) => void, (value: boolean) => void] => {
    const [state, setState] = useState(defaultState);
    const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => { setState(event.target.checked); }, [setState]);
    return [state, onChange, setState];
};

interface Props {
    token: Asset;
    amount: string | undefined;
    address: string;
    showLegacyAddress: boolean;
    setShowLegacyAddress: (b: boolean) => void;
}

export const ShowQRCode: React.FC<Props> = ({
    token, amount, address, showLegacyAddress, setShowLegacyAddress,
}) => {
    const [showSettings, toggleSettings] = useToggle(false);
    const [rawAddress, toggleRawAddress] = useCheckbox(false);
    // const [legacyAddress, toggleLegacyAddress] = useCheckbox(false);

    const toggleLegacyAddress = useCallback((event: React.ChangeEvent<HTMLInputElement>) => { setShowLegacyAddress(event.target.checked); }, [setShowLegacyAddress]);

    return <QRCodeOuter>
        <QRCodeOptionsOuter>
            <QRCodeToggle onClick={toggleSettings}><CogIcon />{" "}QR Code Options</QRCodeToggle>
            {showSettings ? <QRCodeOptions>
                <h4>QR Code Options</h4>
                <label><input type="checkbox" onChange={toggleRawAddress} /> Raw address</label>
                {token === Asset.BCH ? <label><input type="checkbox" onChange={toggleLegacyAddress} /> Legacy address</label> : <></>}
            </QRCodeOptions> : <></>}
        </QRCodeOptionsOuter>
        <QRCodeContainer>
            <QRCode value={`${rawAddress ? "" : (token === Asset.BTC ? "bitcoin:" : token === Asset.ZEC ? "zcash:" : token === Asset.BCH && showLegacyAddress ? "bitcoincash:" : "")}${showLegacyAddress ? toLegacyAddress(address) : address}${amount && !rawAddress ? `?amount=${amount}` : ""}`} />
        </QRCodeContainer>
    </QRCodeOuter>;
};
