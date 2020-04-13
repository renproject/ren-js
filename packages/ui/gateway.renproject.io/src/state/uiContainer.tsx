import { UTXOWithChain } from "@renproject/interfaces";
import { OrderedMap } from "immutable";
import { Container } from "unstated";

const initialState = {
    // web3: new Web3(ETHEREUM_NODE),

    renNetwork: undefined as string | undefined,
    wrongNetwork: undefined as number | undefined,
    expectedNetwork: undefined as string | undefined,

    loggedOut: null as string | null,
    paused: false,

    // address: null as string | null,
    utxos: OrderedMap<string, UTXOWithChain>(),

    gatewayPopupID: null as string | null,
};

export class UIContainer extends Container<typeof initialState> {
    public state = initialState;

    // public connect = async (web3: Web3, address: string | null): Promise<void> => this.setState(state => ({ ...state, web3, address, loggedOut: null }));
    public connect = async (): Promise<void> => this.setState(state => ({ ...state, loggedOut: null }));

    public clearAddress = async (): Promise<void> => this.setState(state => ({ ...state, address: null }));

    public handleTransfer = async (gatewayPopupID: string | null) => this.setState(state => ({ ...state, submitting: false, gatewayPopupID }));

    public resetTransfer = async () => this.setState(state => ({ ...state, gatewayPopupID: null, submitting: false }));

    public deposit = async (deposit: UTXOWithChain) => this.setState(state => ({ ...state, utxos: this.state.utxos.set(deposit.utxo.txid, deposit) }));

    public setSubmitting = async (submitting: boolean) => this.setState(state => ({ ...state, submitting }));

    public setLoggedOut = async (loggedOut?: string) => this.setState(state => ({ ...state, loggedOut: loggedOut || null }));

    public pause = async () => this.setState(state => ({ ...state, paused: true }));
    public resume = async () => this.setState(state => ({ ...state, paused: false }));
    // /**
    //  * lookForLogout detects if the user has changed or logged out of their Web3
    //  * wallet
    //  */
    // public lookForLogout = async () => {
    //     const { address, web3 } = this.state;

    //     if (!address || !web3) { return; }

    //     const accounts = (await web3.eth.getAccounts())
    //         .map((web3Address: string) => web3Address.toLowerCase());

    //     if (!accounts.includes(address.toLowerCase())) {
    //         await this.clearAddress();
    //         await this.setLoggedOut(address);
    //     }
    // }
}
