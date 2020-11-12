import {
    BurnAndReleaseParams,
    DepositCommon,
    LockAndMintParams,
} from "@renproject/interfaces";

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

export const resolveInToken = <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LockTransaction = any,
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<
        LockTransaction
    >,
    LockAddress = string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MintTransaction = any,
    MintAddress = string
>({
    asset,
    from,
    to,
}: {
    asset: LockAndMintParams<
        LockTransaction,
        LockDeposit,
        LockAddress,
        MintTransaction,
        MintAddress
    >["asset"];
    from: LockAndMintParams<
        LockTransaction,
        LockDeposit,
        LockAddress,
        MintTransaction,
        MintAddress
    >["from"];
    to: LockAndMintParams<
        LockTransaction,
        LockDeposit,
        LockAddress,
        MintTransaction,
        MintAddress
    >["to"];
}): string => {
    return `${asset}0${from.legacyName || from.name}2${to.legacyName ||
        from.name}`;
};

export const resolveOutToken = <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LockTransaction = any,
    LockDeposit extends DepositCommon<LockTransaction> = DepositCommon<
        LockTransaction
    >,
    LockAddress = string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MintTransaction = any,
    MintAddress = string
>({
    asset,
    from,
    to,
}: {
    asset: BurnAndReleaseParams<
        LockTransaction,
        LockDeposit,
        LockAddress,
        MintTransaction,
        MintAddress
    >["asset"];
    from: BurnAndReleaseParams<
        LockTransaction,
        LockDeposit,
        LockAddress,
        MintTransaction,
        MintAddress
    >["from"];
    to: BurnAndReleaseParams<
        LockTransaction,
        LockDeposit,
        LockAddress,
        MintTransaction,
        MintAddress
    >["to"];
}): string => {
    if (!from) {
        throw new Error(
            `Unable to calculate Ren selector without \`from\` field.`,
        );
    }
    return `${asset}0${from.legacyName || from.name}2${to.legacyName ||
        from.name}`;
};
