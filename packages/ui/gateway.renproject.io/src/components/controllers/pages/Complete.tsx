import * as React from "react";

import { RenNetworkDetails } from "@renproject/contracts";
import { Asset, Tx } from "@renproject/interfaces";

import { txUrl } from "../../../lib/txUrl";
import { renderChain } from "../../../lib/utils";
import {
    Container, ContainerBody, ContainerBottom, ContainerButtons, ContainerDetails, ContainerHeader,
} from "../../views/Container";
import { ExternalLink } from "../../views/ExternalLink";
import { Mini } from "../../views/Mini";

export const Complete: React.StatelessComponent<{
    onDone: () => Promise<void>,
    pressedDone: boolean;
    inTx: Tx | null,
    outTx: Tx | null,
    mini: boolean,
    token: Asset;
    networkDetails: RenNetworkDetails,
}> = ({ onDone, pressedDone, mini, inTx, outTx, token, networkDetails }) => {

    const txs = inTx && outTx ? <>
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
        </>;

    return mini ?
        <Mini token={token} message="Done" /> :
        <Container>
            <div className="complete">
                <ContainerBody>
                    <ContainerHeader icon={<div className="checkmark--outer"><div className="checkmark" /></div>} />
                    <ContainerDetails>
                        <h4>Deposit received</h4>
                        <div className="complete--links">
                            {txs}
                        </div>
                    </ContainerDetails>
                </ContainerBody>
            </div>
            <ContainerBottom className="complete--buttons">
                <ContainerButtons>
                    <button className="button open--confirm" disabled={pressedDone} onClick={onDone}>Return</button>
                </ContainerButtons>
            </ContainerBottom>
        </Container>;
};
