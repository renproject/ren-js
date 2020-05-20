import * as React from "react";

import { Asset, Chain, Tx } from "@renproject/interfaces";
import { RenNetworkDetails } from "@renproject/contracts";

import { txUrl } from "../../../lib/txUrl";
import { Container } from "../Container";
import { ExternalLink } from "../ExternalLink";
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
    token: Asset;
    networkDetails: RenNetworkDetails,
}> = ({ onDone, pressedDone, mini, inTx, outTx, token, networkDetails }) => {

    return mini ?
        <Mini token={token} message="Done" /> :
        <Container mini={false}>
            <div className="complete">
                <div className="container--body">
                    <div className="circle-loader load-complete">
                        <div className="checkmark draw" />
                    </div>
                    <h4>Deposit received</h4>
                    <div className="container--buttons">
                        {inTx && outTx ? <>
                            <ExternalLink href={txUrl(inTx, networkDetails)}>{renderChain(inTx.chain)} Transaction</ExternalLink>
                            {" "}-{" "}
                            <ExternalLink href={txUrl(outTx, networkDetails)}>{renderChain(outTx.chain)} Transaction</ExternalLink>
                        </> : <>
                                {inTx ?
                                    <ExternalLink href={txUrl(inTx, networkDetails)}>View {renderChain(inTx.chain)} Transaction</ExternalLink> :
                                    <></>
                                }
                                {outTx ?
                                    <>{inTx ? <span style={{ margin: "0px 5px" }}>-</span> : ""}<ExternalLink href={txUrl(outTx, networkDetails)}>View {renderChain(outTx.chain)} Transaction</ExternalLink></> :
                                    <></>
                                }
                            </>
                        }
                    </div>
                </div>
            </div>
            <div className="deposit-address complete--buttons">
                <div className="container--body--actions">
                    <div className="container--buttons">
                        <button className="button open--confirm" disabled={pressedDone} onClick={onDone}>Return</button>
                    </div>
                </div>
            </div>
        </Container>;
};
