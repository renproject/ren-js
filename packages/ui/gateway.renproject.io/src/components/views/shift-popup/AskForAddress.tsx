import * as React from "react";

import { TokenIcon } from "@renproject/react-components";
import { extractError } from "@renproject/utils";

import { Token, Tokens } from "../../../state/generalTypes";
import { Popup } from "../Popup";
import { ConnectedMini } from "./Mini";

export const AskForAddress: React.StatelessComponent<{
    mini: boolean,
    token: Token,
    message: React.ReactNode,
    isTestnet: boolean,
    onAddress(address: string, token: Token): void;
}> = ({ mini, token, message, isTestnet, onAddress }) => {
    // tslint:disable-next-line: prefer-const
    let [address, updateAddress] = React.useState("");
    const [error, updateError] = React.useState(null as string | null);
    const [submitting, updateSubmitting] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement | null>() as React.MutableRefObject<HTMLInputElement | null>;

    const tokenDetails = Tokens.get(token);

    const submit = (event?: React.FormEvent<HTMLFormElement>) => {
        if (event) { event.preventDefault(); }
        if (!error && tokenDetails && !tokenDetails.validator(address, isTestnet)) {
            updateError(`Invalid ${tokenDetails.chain.toUpperCase()} address`);
            return;
        }
        try {
            updateSubmitting(true);
            onAddress(address, token);
        } catch (error) {
            updateError(extractError(error));
            updateSubmitting(false);
        }
    };

    const onChange = (event: React.FormEvent<HTMLInputElement>): void => {
        updateError(null);
        updateAddress((event.target as HTMLInputElement).value);
    };

    if (mini) { return <ConnectedMini message={"Enter address"} />; }

    return <Popup mini={mini}>
        <div className="address-input">
            <div className="popup--body">
                <div className="popup--body--box--title">
                    Enter <TokenIcon token={token} /> {token.toUpperCase()} address
                </div>
                <div className="popup--body--box">

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
                        <button className="button open--confirm" disabled={address === "" || submitting || error !== null} type="submit"><span>{error ? error : "Confirm"}</span></button>
                    </div>
                </form>
            </div>
        </div>
    </Popup>;
};
