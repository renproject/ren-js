import { NetworkDetails, UTXO } from "@renproject/ren";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import { Container } from "unstated";
import Web3 from "web3";

import { syncGetTokenAddress } from "../lib/contractAddresses";
import { ETHEREUM_NODE } from "../lib/environmentVariables";
import { getERC20, Token } from "./generalTypes";
import { network } from "./sdkContainer";

const fetchEthereumTokenBalance = async (web3: Web3, networkID: number, networkDetails: NetworkDetails, token: Token, address: string): Promise<BigNumber> => {
    if (!web3) {
        return new BigNumber(0);
    }
    let balance: string;
    if (token === Token.ETH) {
        balance = await web3.eth.getBalance(address);
    } else {
        // if (isERC20(token)) {
        const tokenAddress = syncGetTokenAddress(networkID, token);
        const tokenInstance = getERC20(web3, networkDetails, tokenAddress);
        balance = (await tokenInstance.methods.balanceOf(address).call()).toString();
        // } else {
        //     throw new Error(`Invalid Ethereum token: ${token}`);
    }
    return new BigNumber(balance);
};

const initialState = {
    web3: new Web3(ETHEREUM_NODE),
    networkID: network.contracts.networkID,
    wrongNetwork: undefined as number | undefined,

    loggedOut: null as string | null,
    paused: false,

    address: null as string | null,
    utxos: OrderedMap<string, UTXO>(),

    gatewayPopupID: null as string | null,
    network,
};

export class UIContainer extends Container<typeof initialState> {
    public state = initialState;

    public connect = async (web3: Web3, address: string | null, networkID: number): Promise<void> => {
        await this.setState(state => ({ ...state, web3, networkID, address, loggedOut: null }));
    }

    public clearAddress = async (): Promise<void> => {
        await this.setState(state => ({ ...state, address: null }));
    }

    public handleShift = async (gatewayPopupID: string | null) => {
        await this.setState(state => ({ ...state, submitting: false, gatewayPopupID }));
    }

    // Token prices ////////////////////////////////////////////////////////////

    public fetchEthereumTokenBalance = async (token: Token, address: string): Promise<BigNumber> => {
        const { web3, networkID, network: networkDetails } = this.state;
        if (!web3) {
            return new BigNumber(0);
        }
        return fetchEthereumTokenBalance(web3, networkID, networkDetails, token, address);
    }

    public resetTrade = async () => {
        await this.setState(state => ({
            ...state,
            gatewayPopupID: null,
            submitting: false,
        }));
    }

    public deposit = async (deposit: UTXO) => {
        const utxos = this.state.utxos.set(deposit.utxo.txid, deposit);
        await this.setState(state => ({
            ...state,
            utxos,
        }));
    }

    public setSubmitting = async (submitting: boolean) => {
        await this.setState(state => ({
            ...state,
            submitting,
        }));
    }

    public setLoggedOut = async (loggedOut?: string) => {
        return this.setState(state => ({ ...state, loggedOut: loggedOut || null }));
    }

    public pause = async () => {
        return this.setState(state => ({ ...state, paused: true }));
    }

    public resume = async () => {
        await this.setState(state => ({ ...state, paused: false }));
    }

    // lookForLogout detects if the user has changed or logged out of their Web3
    // wallet
    public lookForLogout = async () => {
        const { address, web3 } = this.state;

        if (!address || !web3) {
            return;
        }

        const accounts = (await web3.eth.getAccounts())
            .map((web3Address: string) => web3Address.toLowerCase());

        if (!accounts.includes(address.toLowerCase())) {
            await this.clearAddress();
            await this.setLoggedOut(address);
        }
    }
}
