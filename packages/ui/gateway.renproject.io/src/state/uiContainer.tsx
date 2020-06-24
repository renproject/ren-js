import { UTXOWithChain } from "@renproject/interfaces";
import { OrderedMap } from "immutable";
import { Container } from "unstated";

const initialState = {
    renNetwork: undefined as string | undefined,
    wrongNetwork: undefined as number | undefined,
    expectedNetwork: undefined as string | undefined,

    showingSettings: false,
    paused: false,

    gatewayPopupID: null as string | null,
    utxos: OrderedMap<string, UTXOWithChain>(),
};

export class UIContainer extends Container<typeof initialState> {
    public state = initialState;

    // Transfer details
    public handleTransfer = async (gatewayPopupID: string | null) => this.setState(state => ({ ...state, submitting: false, gatewayPopupID }));
    public resetTransfer = async () => this.setState(state => ({ ...state, gatewayPopupID: null, submitting: false }));
    public setSubmitting = async (submitting: boolean) => this.setState(state => ({ ...state, submitting }));

    // Settings
    public hideSettings = async () => this.setState(state => ({ ...state, showingSettings: false }));
    public toggleSettings = async () => this.setState(state => ({ ...state, showingSettings: !state.showingSettings }));

    public deposit = async (deposit: UTXOWithChain) => this.setState(state => ({ ...state, utxos: this.state.utxos.set(deposit.utxo.txHash, deposit) }));

    // Pause state
    public pause = async () => this.setState(state => ({ ...state, paused: true }));
    public resume = async () => this.setState(state => ({ ...state, paused: false }));
}
