import { UTXOWithChain } from "@renproject/interfaces";
import { OrderedMap } from "immutable";
import { useState } from "react";
import { createContainer } from "unstated-next";

export const useUIContainer = () => {
    const [submitting, setSubmitting] = useState(false);
    const [renNetwork, setRenNetwork] = useState(undefined as string | undefined);
    const [wrongNetwork, setWrongNetwork] = useState(undefined as number | undefined);
    const [expectedNetwork, setExpectedNetwork] = useState(undefined as string | undefined);

    const [showingSettings, setShowingSettings] = useState(false);
    const [paused, setPaused] = useState(false);

    const [gatewayPopupID, setGatewayPopupID] = useState(null as string | null);
    const [utxos, setUtxos] = useState(OrderedMap<string, UTXOWithChain>());

    // Transfer details
    const handleTransfer = async (nextGatewayPopupID: string | null) => {
        setGatewayPopupID(nextGatewayPopupID);
        setSubmitting(false);
    };
    const resetTransfer = async () => {
        setGatewayPopupID(null);
        setSubmitting(false);
    };

    // Settings
    const hideSettings = async () => { setShowingSettings(false); };
    const toggleSettings = async () => { setShowingSettings(state => !state); };
    const deposit = async (newDeposit: UTXOWithChain) => { setUtxos(state => state.set(newDeposit.utxo.txHash, newDeposit)); };

    // Pause state
    const pause = async () => { setPaused(true); };
    const resume = async () => { setPaused(false); };

    return {
        submitting, setSubmitting,
        renNetwork, setRenNetwork,
        wrongNetwork, setWrongNetwork,
        expectedNetwork, setExpectedNetwork,
        showingSettings,
        paused,
        gatewayPopupID,
        utxos,

        handleTransfer,
        resetTransfer,
        hideSettings,
        toggleSettings,
        deposit,
        pause,
        resume,
    };
};

export const UIContainer = createContainer(useUIContainer);
