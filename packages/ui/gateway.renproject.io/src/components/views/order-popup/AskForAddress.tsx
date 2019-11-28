import * as React from "react";

import { TokenIcon } from "@renproject/react-components";
import { Chain } from "@renproject/ren";

import { IS_TESTNET } from "../../../lib/environmentVariables";
import { Token, Tokens } from "../../../state/generalTypes";
import { ReactComponent as MetaMask } from "../../../styles/images/metamask.svg";
import { Popup } from "../Popup";

export const AskForAddress: React.StatelessComponent<{
    token: Token,
    message: React.ReactNode,
    defaultAddress: string,
    onAddress(address: string): void;
    cancel(): void;
}> = ({ token, message, defaultAddress, onAddress, cancel }) => {
    // tslint:disable-next-line: prefer-const
    let [address, updateAddress] = React.useState("");
    const [error, updateError] = React.useState(null as string | null);
    const [submitting, updateSubmitting] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement | null>() as React.MutableRefObject<HTMLInputElement | null>;

    const tokenDetails = Tokens.get(token);

    const submit = (event?: React.FormEvent<HTMLFormElement>) => {
        if (event) { event.preventDefault(); }
        if (!error && tokenDetails && !tokenDetails.validator(address, IS_TESTNET)) {
            updateError(`Invalid ${tokenDetails.chain.toUpperCase()} address`);
            return;
        }
        try {
            updateSubmitting(true);
            onAddress(address);
        } catch (error) {
            updateError(String(error.message || error));
            updateSubmitting(false);
        }
    };

    const useDefaultAddress = () => {
        address = defaultAddress;
        updateAddress(defaultAddress);
        const current = inputRef.current;
        if (current) {
            current.focus();
        }
    };

    const onChange = (event: React.FormEvent<HTMLInputElement>): void => {
        updateError(null);
        updateAddress((event.target as HTMLInputElement).value);
    };

    React.useEffect(() => {
        if (tokenDetails && tokenDetails.chain === Chain.Ethereum) {
            address = defaultAddress;
            updateAddress(defaultAddress);
            submit();
        }
    }, [tokenDetails]);

    return <Popup cancel={cancel}>
        <div className="address-input">
            <div className="popup--body">
                <TokenIcon className="token-icon" token={token} />
                <h2>{token} address</h2>
                <div className="address-input--message">
                    {message}
                </div>
                <form onSubmit={submit}>
                    <div className="form-group">
                        <input
                            type="text"
                            className="form-control"
                            onChange={onChange}
                            value={address}
                            autoFocus={true}
                            required={true}
                            aria-required={true}
                            ref={inputRef}
                        />
                        <label className="form-control-placeholder">{token} address</label>
                        {tokenDetails && tokenDetails.chain === Chain.Ethereum ?
                            <button type="button" className="metamask-logo" onClick={useDefaultAddress}><MetaMask /></button> :
                            null
                        }
                    </div>
                    {error ? <span className="red"><br />{error}</span> : null}
                    <div className="popup--buttons">
                        <button className="button open--confirm" disabled={address === "" || submitting || error !== null} type="submit"><span>{"Confirm"}</span></button>
                    </div>
                </form>
            </div>
        </div>
    </Popup>;
};
