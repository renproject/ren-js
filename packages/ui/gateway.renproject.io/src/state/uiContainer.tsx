import { UTXO } from "@renproject/ren";
import { OrderedMap } from "immutable";
import { Container } from "unstated";
import Web3 from "web3";

import { ETHEREUM_NODE } from "../lib/environmentVariables";

const initialState = {
    web3: new Web3(ETHEREUM_NODE),

    renNetwork: undefined as string | undefined,
    wrongNetwork: undefined as number | undefined,
    expectedNetwork: undefined as string | undefined,

    loggedOut: null as string | null,
    paused: false,

    address: null as string | null,
    utxos: OrderedMap<string, UTXO>(),

    gatewayPopupID: null as string | null,
};

export class UIContainer extends Container<typeof initialState> {
    public state = initialState;

    public connect = async (web3: Web3, address: string | null): Promise<void> => {
        await this.setState(state => ({ ...state, web3, address, loggedOut: null }));
    }

    public clearAddress = async (): Promise<void> => {
        await this.setState(state => ({ ...state, address: null }));
    }

    public handleShift = async (gatewayPopupID: string | null) => {
        await this.setState(state => ({ ...state, submitting: false, gatewayPopupID }));
    }

    // Token prices ////////////////////////////////////////////////////////////

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
