import { Asset } from "@renproject/interfaces";
import React from "react";

import { ReactComponent as Brave } from "../../scss/images/wallets/brave.svg";
import { ReactComponent as Coinbase } from "../../scss/images/wallets/coinbase.svg";
import { ReactComponent as Imtoken } from "../../scss/images/wallets/imtoken.svg";
import { ReactComponent as Metamask } from "../../scss/images/wallets/metamask.svg";
import { ReactComponent as Status } from "../../scss/images/wallets/status.svg";
import { ReactComponent as Trust } from "../../scss/images/wallets/trust.svg";
import { Container, ContainerBody } from "./Container";
import { ExternalLink } from "./ExternalLink";
import { Mini } from "./Mini";

interface Props {
    token: Asset;
    paused: boolean;
    wrongNetwork: number | undefined;
    correctNetwork: string;
}

export const LogIn: React.FC<Props> = ({ token, paused, wrongNetwork, correctNetwork }) => (
    paused ?
        <Mini token={token} message="Connect Web3" /> :
        <Container>
            <ContainerBody className="container--loading connect-web3">
                <div className="connect-web3--browsers">
                    {/* tslint:disable: react-a11y-anchors */}
                    <ExternalLink title="Metamask Web3 Browser" href="https://metamask.io/"><Metamask /></ExternalLink>
                    <ExternalLink title="Coinbase Web3 Browser" href="https://wallet.coinbase.com/"><Coinbase /></ExternalLink>
                    <ExternalLink title="Trust Web3 Browser" href="https://trustwallet.com/"><Trust /></ExternalLink>
                    <ExternalLink title="Imtoken Web3 Browser" href="https://www.token.im/"><Imtoken /></ExternalLink>
                    <ExternalLink title="Brave Web3 Browser" href="https://brave.com/"><Brave /></ExternalLink>
                    <ExternalLink title="Status Web3 Browser" href="https://status.im"><Status /></ExternalLink>
                    {/* tslint:enable: react-a11y-anchors */}
                </div>
                {wrongNetwork ? <>Please switch to the {correctNetwork} Ethereum network.</> : <>Connect your Ethereum Web3 wallet to continue</>}
            </ContainerBody>
        </Container>
);
