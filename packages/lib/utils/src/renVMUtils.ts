import {
    Asset,
    BurnAndReleaseParams,
    Chain,
    DepositCommon,
    LockAndMintParams,
    RenContract,
} from "@renproject/interfaces";

interface RenContractDetails {
    asset: Asset;
    from: Chain;
    to: Chain;
}

const renContractRegex = /^(.*)0(.*)2(.*)$/;
const defaultMatch = [undefined, undefined, undefined, undefined];

/**
 * parseRenContract splits a RenVM contract (e.g. `BTC0Eth2Btc`) into the asset
 * (`BTC`), the origin chain (`Eth`) and the target chain (`Btc`).
 */
export const parseRenContract = (
    renContract: RenContract
): RenContractDetails => {
    // re.exec("BTC0Eth2Btc") => ['BTC0Eth2Btc', 'BTC', 'Eth', 'Btc']
    const [, asset, from, to] =
        renContractRegex.exec(renContract) || defaultMatch;
    if (!asset || !from || !to) {
        throw new Error(`Invalid Ren Contract "${renContract}"`);
    }

    return {
        asset: asset as Asset,
        from: from as Chain,
        to: to as Chain,
    };
};

export const resolveInToken = <
    // tslint:disable-next-line: no-any
    Transaction = any,
    Deposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
    // tslint:disable-next-line: no-shadowed-variable
    Asset extends string = string,
    Address = string
>({
    asset,
    from,
    to,
}: {
    asset: LockAndMintParams<Transaction, Deposit, Asset, Address>["asset"];
    from: LockAndMintParams<Transaction, Deposit, Asset, Address>["from"];
    to: LockAndMintParams<Transaction, Deposit, Asset, Address>["to"];
}): RenContract => {
    return `${asset}0${from.name}2${to.name}` as RenContract;
};

export const resolveOutToken = <
    // tslint:disable-next-line: no-any
    Transaction = any,
    Deposit extends DepositCommon<Transaction> = DepositCommon<Transaction>,
    // tslint:disable-next-line: no-shadowed-variable
    Asset extends string = string,
    Address = string
>({
    asset,
    from,
    to,
}: {
    asset: BurnAndReleaseParams<Transaction, Deposit, Asset, Address>["asset"];
    from: BurnAndReleaseParams<Transaction, Deposit, Asset, Address>["from"];
    to: BurnAndReleaseParams<Transaction, Deposit, Asset, Address>["to"];
}): RenContract => {
    return `${asset}0${from.name}2${to.name}` as RenContract;
};
