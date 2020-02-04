import { Token } from "../state/generalTypes";

const network = process.env.REACT_APP_NETWORK || "testnet";

// tslint:disable: non-literal-require
export const syncGetTokenAddress = (networkID: number, token: Token): string => {
    // eslint-disable-next-line
    switch (token) {
        // case Token.DAI:
        //     const deployedDaiNetworks = require(`../contracts/${network}/DaiToken.json`).networks;
        //     return deployedDaiNetworks[networkID].address;
        case Token.ETH:
            return "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        case Token.BTC:
            const deployedBTCNetworks = require(`../contracts/${network}/zBTC.json`).networks;
            return deployedBTCNetworks[networkID].address;
        case Token.ZEC:
            const deployedZECNetworks = require(`../contracts/${network}/zZEC.json`).networks;
            return deployedZECNetworks[networkID].address;
        case Token.BCH:
            const deployedBCHNetworks = require(`../contracts/${network}/zBCH.json`).networks;
            return deployedBCHNetworks[networkID].address;
    }
};
