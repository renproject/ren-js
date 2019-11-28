import { AbiInput } from "web3-utils";

import { Token } from "../state/generalTypes";

const network = process.env.REACT_APP_NETWORK || "testnet";

// tslint:disable: non-literal-require
export const syncGetTokenAddress = (networkID: number, token: Token): string => {
    // eslint-disable-next-line
    switch (token) {
        case Token.DAI:
            const deployedDaiNetworks = require(`../contracts/${network}/DaiToken.json`).networks;
            return deployedDaiNetworks[networkID].address;
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

const tokensFromAddresses = {};

export const syncGetTokenFromAddress = (networkID: number, address: string): Token => {
    // eslint-disable-next-line

    // tslint:disable: no-string-literal
    if (address === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") { return Token.ETH; }
    tokensFromAddresses["DAI"] = tokensFromAddresses["DAI"] || require(`../contracts/${network}/DaiToken.json`).networks[networkID].address;
    if (address === tokensFromAddresses["DAI"]) { return Token.DAI; }
    tokensFromAddresses["BTC"] = tokensFromAddresses["BTC"] || require(`../contracts/${network}/zBTC.json`).networks[networkID].address;
    if (address === tokensFromAddresses["BTC"]) { return Token.BTC; }
    tokensFromAddresses["ZEC"] = tokensFromAddresses["ZEC"] || require(`../contracts/${network}/zZEC.json`).networks[networkID].address;
    if (address === tokensFromAddresses["ZEC"]) { return Token.ZEC; }
    tokensFromAddresses["BCH"] = tokensFromAddresses["BCH"] || require(`../contracts/${network}/zBCH.json`).networks[networkID].address;
    if (address === tokensFromAddresses["BCH"]) { return Token.BCH; }
    // tslint:enable: no-string-literal

    throw new Error("Unknown token");
};

// tslint:disable: non-literal-require
export const syncGetDEXReserveAddress = (networkID: number, token: Token): string => {
    // eslint-disable-next-line
    switch (token) {
        case Token.BTC:
            const deployedBTCReserveNetworks = require(`../contracts/${network}/BTC_DAI_Reserve.json`).networks;
            return deployedBTCReserveNetworks[networkID].address;
        case Token.ZEC:
            const deployedZECReserveNetworks = require(`../contracts/${network}/ZEC_DAI_Reserve.json`).networks;
            return deployedZECReserveNetworks[networkID].address;
        case Token.BCH:
            const deployedBCHReserveNetworks = require(`../contracts/${network}/BCH_DAI_Reserve.json`).networks;
            return deployedBCHReserveNetworks[networkID].address;
    }
    return "";
};

export const syncGetDEXAddress = (networkID: number): string => {
    const renExNetworks = require(`../contracts/${network}/DEX.json`).networks;
    return renExNetworks[networkID].address;
};

export const syncGetDEXTradeLog = (): AbiInput[] => {
    const abi = require(`../contracts/${network}/DEX.json`).abi;
    for (const logAbi of abi) {
        if (logAbi.type === "event" && logAbi.name === "LogTrade") {
            return logAbi.inputs;
        }
    }
    return [];
};

export const syncGetTransfer = (): AbiInput[] => {
    const abi = require(`../contracts/${network}/DaiToken.json`).abi;
    for (const logAbi of abi) {
        if (logAbi.type === "event" && logAbi.name === "Transfer") {
            return logAbi.inputs;
        }
    }
    return [];
};

export const syncGetDEXAdapterAddress = (networkID: number): string => {
    const renExNetworks = require(`../contracts/${network}/DEXAdapter.json`).networks;
    return renExNetworks[networkID].address;
};

export const getTokenDecimals = (token: Token): number => {
    switch (token) {
        case Token.DAI:
            return 18;
        case Token.ETH:
            return 18;
        case Token.BTC:
            return 8;
        case Token.ZEC:
            return 8;
        case Token.BCH:
            return 8;
    }
};
