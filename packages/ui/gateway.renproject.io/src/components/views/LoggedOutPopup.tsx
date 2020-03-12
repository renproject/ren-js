import * as React from "react";

import { Blocky, Loading } from "@renproject/react-components";
import { parse as parseLocation } from "qs";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { DEFAULT_NETWORK } from "../../lib/environmentVariables";
import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { Popup } from "./Popup";

interface Props {
    oldAccount: string;
}

// export const LoggedOutPopup = withRouter(connect<Props & RouteComponentProps & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
//     ({ oldAccount, containers: [uiContainer, sdkContainer], location }) => {
//         const [accounts, setAccounts] = React.useState(null as string[] | null);

//         const { web3 } = uiContainer.state;
//         const { sdkRenVM } = sdkContainer.state;

//         const onLogin = React.useCallback((address: string) => {
//             if (!web3) {
//                 return;
//             }

//             const queryParams = parseLocation(location.search.replace(/^\?/, ""));
//             const network: string = sdkRenVM ? sdkRenVM.network.name : (queryParams.network || DEFAULT_NETWORK);

//             uiContainer.connect(web3, address).catch((error) => _catchInteractionErr_(error, "Error in LoggedOutPopup: uiContainer.connect"));
//             sdkContainer.connect(web3, address, network).catch((error) => _catchInteractionErr_(error, "Error in LoggedOutPopup: sdkContainer.connect"));
//         }, [uiContainer, sdkContainer, web3, sdkRenVM, location.search]);

//         React.useEffect(() => {
//             (async () => {
//                 if (web3) {
//                     const newAccounts = await web3.eth.getAccounts();
//                     setAccounts(newAccounts);
//                 }
//             })().catch((error) => _catchInteractionErr_(error, "Error in LoggedOutPopup: getAccounts"));
//         }, [web3]);

//         return <Popup mini={false}>
//             <div className="logged-out popup--body">
//                 <h2>Logged out</h2>
//                 <p>The address <span className="address">{oldAccount.slice(0, 12)}<span>{oldAccount.slice(12, -6)}</span>{oldAccount.slice(-6, -1)}</span> is no longer selected in your Web3 wallet.</p>
//                 {accounts ?
//                     accounts.length > 0 ?
//                         <>
//                             <p>Select one of the accounts below to continue trading:</p>
//                             <div className="logged-out--accounts">
//                                 {accounts.map(account => {
//                                     const onClick = () => { onLogin(account); };
//                                     return <button onClick={onClick} key={account} className="logged-out--account">
//                                         <Blocky address={account} /> <span className="logged-out--account--short">{account}</span>
//                                     </button>;
//                                 })}
//                             </div>
//                         </> :
//                         <p>Log in to continue trading.</p>
//                     : <Loading />
//                 }
//             </div>
//         </Popup>;
//     }
// ));
