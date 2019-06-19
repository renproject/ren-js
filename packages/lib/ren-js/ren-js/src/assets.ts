
export enum Chain {
    Bitcoin = "Btc",
    Ethereum = "Eth",
    ZCash = "Zec",
}

export enum Asset {
    BTC = "BTC",
    ZEC = "ZEC",
    ETH = "ETH"
}

export enum ShiftAction {
    Btc2Eth = "BTC0Btc2Eth",
    Eth2Btc = "BTC0Eth2Btc",
}

export const ShiftActions = {
    BTC: {
        Btc2Eth: ShiftAction.Btc2Eth,
        Eth2Btc: ShiftAction.Eth2Btc,
    }
};

export interface ActionDetails {
    asset: Asset;
    from: Chain;
    to: Chain;
}

const shiftActionRegex = /^(.*)0(.*)2(.*)$/;
const defaultMatch = [undefined, undefined, undefined, undefined];

// actionToDetails splits an action (e.g. `BTC0Eth2Btc`) into the asset
// (`BTC`), the from chain (`Eth`)
export const actionToDetails = (shiftAction: ShiftAction): ActionDetails => {
    // re.exec("BTC0Eth2Btc") => ['BTC0Eth2Btc', 'BTC', 'Eth', 'Btc']
    const [, asset, from, to] = shiftActionRegex.exec(shiftAction) || defaultMatch;
    if (!asset || !from || !to) {
        throw new Error("Invalid shift action");
    }

    return {
        asset: asset as Asset,
        from: from as Chain,
        to: to as Chain
    };
};
