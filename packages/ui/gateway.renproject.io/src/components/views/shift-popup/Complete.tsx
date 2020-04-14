import * as React from "react";

import { Chain, Tx } from "@renproject/interfaces";
import { TokenIcon } from "@renproject/react-components";
import { NetworkDetails } from "@renproject/utils/build/main/types/networks";

import { txUrl } from "../../../lib/txUrl";
import { Token } from "../../../state/generalTypes";
import { Popup } from "../Popup";
import { Mini } from "./Mini";

const renderChain = (chain: Chain): string => {
    switch (chain) {
        case Chain.Bitcoin:
            return "Bitcoin";
        case Chain.Ethereum:
            return "Ethereum";
        case Chain.Zcash:
            return "Zcash";
        case Chain.BitcoinCash:
            return "Bitcoin Cash";
    }
    return chain;
};

export const Complete: React.StatelessComponent<{
    onDone: () => Promise<void>,
    pressedDone: boolean;
    inTx: Tx | null,
    outTx: Tx | null,
    mini: boolean,
    token: Token;
    networkDetails: NetworkDetails,
}> = ({ onDone, pressedDone, mini, inTx, outTx, token, networkDetails }) => {

    return mini ?
        <Mini token={token} message="Done" /> :
        <Popup mini={false}>
            <div className="complete">
                <div className="popup--body">
                    <div className="circle-loader load-complete">
                        <div className="checkmark draw" />
                    </div>
                    <h4>Deposit received</h4>
                    <div className="popup--buttons">
                        {inTx && outTx ? <>
                            <a target="_blank" rel="noopener noreferrer" href={txUrl(inTx, networkDetails)}>{renderChain(inTx.chain)} Transaction</a>
                            {" "}-{" "}
                            <a target="_blank" rel="noopener noreferrer" href={txUrl(outTx, networkDetails)}>{renderChain(outTx.chain)} Transaction</a>
                        </> : <>
                                {inTx ?
                                    <a target="_blank" rel="noopener noreferrer" href={txUrl(inTx, networkDetails)}>View {renderChain(inTx.chain)} Transaction</a> :
                                    <></>
                                }
                                {outTx ?
                                    <>{inTx ? <>{" "}-{" "}</> : ""}<a target="_blank" rel="noopener noreferrer" href={txUrl(outTx, networkDetails)}>View {renderChain(outTx.chain)} Transaction</a></> :
                                    <></>
                                }
                            </>
                        }
                    </div>
                </div>
            </div>
            <div className="deposit-address complete--buttons">
                <div className="popup--body--actions">
                    <div className="popup--buttons">
                        <button className="button open--confirm" disabled={pressedDone} onClick={onDone}>Return</button>
                    </div>
                </div>
            </div>
        </Popup>;
};
