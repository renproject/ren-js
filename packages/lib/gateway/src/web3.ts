// tslint:disable: no-console

import { errors } from "@renproject/interfaces";
import Web3 from "web3";
import { HttpProvider, provider as Web3Provider } from "web3-providers";

export {
    Chain, RenNetwork as Network, RenNetwork, Tokens, HistoryEvent,
    LockAndMintStatus, BurnAndReleaseStatus, LockAndMintEvent, BurnAndReleaseEvent,
} from "@renproject/interfaces";


interface InjectedEthereum extends HttpProvider {
    enable: () => Promise<void>;
}

export const useBrowserWeb3 = async (): Promise<Web3Provider> => {
    let injectedProvider;

    interface Web3Window {
        web3?: Web3;
        ethereum?: InjectedEthereum;
    }

    const web3Window = window as Web3Window;
    if (web3Window.ethereum) {
        await web3Window.ethereum.enable();
        injectedProvider = web3Window.ethereum;
    } else if (web3Window.web3) {
        injectedProvider = web3Window.web3.currentProvider;
    } else {
        throw new Error(errors.NO_BROWSER_WEB3);
    }

    return injectedProvider as Web3Provider;
};
