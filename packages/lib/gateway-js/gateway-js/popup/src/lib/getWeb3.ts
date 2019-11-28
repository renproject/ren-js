import Web3 from "web3";
import { HttpProvider } from "web3-providers";

interface InjectedEthereum extends HttpProvider {
    enable: () => Promise<void>;
}

declare global {
    interface Window {
        ethereum?: InjectedEthereum;
        web3?: Web3;
    }
}

export const getWeb3 = async () => new Promise<Web3>(async (resolve, reject) => {
    // Modern dApp browsers...
    if (window.ethereum) {
        try {
            // Request account access if needed
            console.log(`Getting ethereum`);
            await window.ethereum.enable();
            console.log(`got ethereum`);
            resolve(new Web3(window.ethereum));
        } catch (error) {
            console.log(`no ethereum`);
            reject(error);
        }
    } else if (window.web3) {
        // Accounts always exposed
        resolve(new Web3(window.web3.currentProvider));
    } else {
        // Non-dApp browsers...
        reject(new Error(`No Web3 detected.`));
    }
});
