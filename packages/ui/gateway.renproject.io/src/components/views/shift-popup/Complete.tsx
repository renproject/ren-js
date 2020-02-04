import * as React from "react";

import { Tx } from "@renproject/ren-js-common";

import { txUrl } from "../../../lib/txUrl";
import { Popup } from "../Popup";

export const Complete: React.StatelessComponent<{
    inTx: Tx | null,
    outTx: Tx | null,
    mini: boolean,
}> = ({ mini, inTx, outTx }) => {
    return <Popup mini={mini}>
        <div className="complete">
            <div className="popup--body">
                <div className="circle-loader load-complete">
                    <div className="checkmark draw" />
                </div>
                <h2>Transaction successful</h2>
                <p>Your cross-chain transaction has been successfully completed. For more information on your transactions click the explorer links below.</p>
                <div className="popup--buttons">
                    {inTx ? <a target="_blank" rel="noopener noreferrer" href={txUrl(inTx)}><button>View {inTx.chain} Transaction</button></a> : <></>}
                    {outTx ? <a target="_blank" rel="noopener noreferrer" href={txUrl(outTx)}><button>View {outTx.chain} Transaction</button></a> : <></>}
                </div>
            </div>
        </div>
    </Popup>;
};
