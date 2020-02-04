import * as React from "react";

import { Blocky, Loading } from "@renproject/react-components";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { Popup } from "./Popup";

interface Props {
    oldAccount: string;
}

export const LoggedOutPopup = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ oldAccount, containers: [uiContainer, sdkContainer] }) => {
        const [accounts, setAccounts] = React.useState(null as string[] | null);

        const { web3, networkID } = uiContainer.state;

        const onLogin = React.useCallback((address: string) => {
            if (!web3) {
                return;
            }
            uiContainer.connect(web3, address, networkID).catch((error) => _catchInteractionErr_(error, "Error in LoggedOutPopup: uiContainer.connect"));
            sdkContainer.connect(web3, address).catch((error) => _catchInteractionErr_(error, "Error in LoggedOutPopup: sdkContainer.connect"));
        }, [uiContainer, sdkContainer, web3, networkID]);

        React.useEffect(() => {
            (async () => {
                if (web3) {
                    const newAccounts = await web3.eth.getAccounts();
                    setAccounts(newAccounts);
                }
            })().catch((error) => _catchInteractionErr_(error, "Error in LoggedOutPopup: getAccounts"));
        }, [networkID, web3]);

        return <Popup mini={false}>
            <div className="logged-out popup--body">
                <h2>Logged out</h2>
                <p>The address <span className="address">{oldAccount.slice(0, 12)}<span>{oldAccount.slice(12, -6)}</span>{oldAccount.slice(-6, -1)}</span> is no longer selected in your Web3 wallet.</p>
                {accounts ?
                    accounts.length > 0 ?
                        <>
                            <p>Select one of the accounts below to continue trading:</p>
                            <div className="logged-out--accounts">
                                {accounts.map(account => {
                                    const onClick = () => { onLogin(account); };
                                    return <button onClick={onClick} key={account} className="logged-out--account">
                                        <Blocky address={account} /> <span className="logged-out--account--short">{account}</span>
                                    </button>;
                                })}
                            </div>
                        </> :
                        <p>Log in to continue trading.</p>
                    : <Loading />
                }
            </div>
        </Popup>;
    }
);
