import * as React from "react";

import { TokenIcon } from "@renproject/react-components";
import { Tx } from "@renproject/ren-js-common";
import { NetworkDetails } from "@renproject/ren/build/main/types/networks";

import { txUrl } from "../../../lib/txUrl";
import { Token } from "../../../state/generalTypes";
import { Popup } from "../Popup";

export const Complete: React.StatelessComponent<{
    inTx: Tx | null,
    outTx: Tx | null,
    mini: boolean,
    token: Token;
    networkDetails: NetworkDetails,
}> = ({ mini, inTx, outTx, token, networkDetails }) => mini ?
    <Popup mini={true}>
        <div className="side-strip"><TokenIcon token={token} /></div>
        <div className="popup--body--details">
            Done
                </div>
    </Popup> :
    <Popup mini={false}>
        <div className="complete">
            <div className="popup--body">
                <div className="circle-loader load-complete">
                    <div className="checkmark draw" />
                </div>
                <h2>Transaction successful</h2>
                <p>Your cross-chain transaction has been successfully completed. For more information on your transactions click the explorer links below.</p>
                <div className="popup--buttons">
                    {inTx ? <a target="_blank" rel="noopener noreferrer" href={txUrl(inTx, networkDetails)}><button>View {inTx.chain} Transaction</button></a> : <></>}
                    {outTx ? <a target="_blank" rel="noopener noreferrer" href={txUrl(outTx, networkDetails)}><button>View {outTx.chain} Transaction</button></a> : <></>}
                </div>
            </div>
        </div>
    </Popup>;
