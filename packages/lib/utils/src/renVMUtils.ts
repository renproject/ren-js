interface V1SelectorDetails {
    asset: string;
    from: string;
    to: string;
}

const v1SelectorRegex = /^(.*)0(.*)2(.*)$/;
const defaultMatch = [undefined, undefined, undefined, undefined];

/**
 * parseV1Selector splits a RenVM contract (e.g. `BTC0Eth2Btc`) into the asset
 * (`BTC`), the origin chain (`Eth`) and the target chain (`Btc`).
 */
export const parseV1Selector = (selector: string): V1SelectorDetails => {
    // re.exec("BTC0Eth2Btc") => ['BTC0Eth2Btc', 'BTC', 'Eth', 'Btc']
    const [, asset, from, to] = v1SelectorRegex.exec(selector) || defaultMatch;
    if (!asset || !from || !to) {
        throw new Error(`Invalid Ren Contract "${selector}"`);
    }

    return {
        asset: asset,
        from: from,
        to: to,
    };
};
