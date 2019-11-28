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
            uiContainer.connect(web3, address, networkID).catch(_catchInteractionErr_);
            sdkContainer.connect(web3, address, networkID).catch(_catchInteractionErr_);
        }, [uiContainer, sdkContainer, web3, networkID]);

        const close = React.useCallback(() => {
            uiContainer.setLoggedOut().catch(_catchInteractionErr_);
        }, [uiContainer]);

        React.useEffect(() => {
            (async () => {
                if (web3) {
                    const newAccounts = await web3.eth.getAccounts();
                    setAccounts(newAccounts);
                }
            })().catch(_catchInteractionErr_);
        }, [networkID, web3]);

        return <Popup cancel={close}>
            <div className="logged-out">
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
                                        <Blocky address={account} /> <span>{account}</span>
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
