import {
    Asset, BurnAndReleaseStatus, Chain, EventType, HistoryEvent, isAsset, LockAndMintStatus,
    TxStatus,
} from "@renproject/interfaces";
import { parseRenContract, resolveInToken, resolveOutToken } from "@renproject/utils";
import QueryString from "qs";

export const range = (left: number, right?: number) => {
    const start = right === undefined ? 0 : left;
    const end = right === undefined ? left : right;
    return Array.from(new Array(end - start)).map((_, i) => i + start);
};

const maxBy = <T>(fn: (t: T) => number, rest: T[]): T => {
    return rest.slice(1).reduce((acc, next) => fn(next) > fn(acc) ? next : acc, rest[0]);
};

export const compareTxStatus = (...statuses: Array<TxStatus | undefined | null>): TxStatus | undefined => {
    return maxBy(
        (status: { status: TxStatus | undefined, index: number }) => status.index,
        statuses.map(status => {
            switch (status) {
                case TxStatus.TxStatusNil: return { status, index: 0 };
                case TxStatus.TxStatusConfirming: return { status, index: 1 };
                case TxStatus.TxStatusPending: return { status, index: 2 };
                case TxStatus.TxStatusExecuting: return { status, index: 3 };
                case TxStatus.TxStatusDone: return { status, index: 4 };
                case TxStatus.TxStatusReverted: return { status, index: 5 };

                default: return { status: undefined, index: -1 };
            }
        }),
    ).status;
};

export const compareTransferStatus = (...statuses: Array<LockAndMintStatus | BurnAndReleaseStatus | undefined | null>): LockAndMintStatus | BurnAndReleaseStatus | undefined => {
    return maxBy(
        (status: { status: LockAndMintStatus | BurnAndReleaseStatus | undefined, index: number }) => status.index,
        statuses.map(status => {
            switch (status) {
                case LockAndMintStatus.Committed: return { status, index: 0 };
                case LockAndMintStatus.Deposited: return { status, index: 1 };
                case LockAndMintStatus.Confirmed: return { status, index: 2 };
                case LockAndMintStatus.SubmittedToRenVM: return { status, index: 3 };
                case LockAndMintStatus.ReturnedFromRenVM: return { status, index: 4 };
                case LockAndMintStatus.SubmittedToEthereum: return { status, index: 5 };
                case LockAndMintStatus.ConfirmedOnEthereum: return { status, index: 6 };

                case BurnAndReleaseStatus.Committed: return { status, index: 0 };
                case BurnAndReleaseStatus.SubmittedToEthereum: return { status, index: 1 };
                case BurnAndReleaseStatus.ConfirmedOnEthereum: return { status, index: 2 };
                case BurnAndReleaseStatus.SubmittedToRenVM: return { status, index: 3 };
                case BurnAndReleaseStatus.ReturnedFromRenVM: return { status, index: 4 };
                case BurnAndReleaseStatus.NoBurnFound: return { status, index: 5 };

                default: return { status: undefined, index: -1 };
            }
        }),
    ).status;
};

export const maxOrUndefined = (left: number | undefined, right: number | undefined) => {
    return left === undefined ? right :
        right === undefined ? left :
            Math.max(left, right);
};

// tslint:disable-next-line: no-any
export const extractQuery = <T extends any>(query: string | QueryString.ParsedQs | string[] | QueryString.ParsedQs[] | undefined, fallback: T): string | T => {
    if (Array.isArray(query)) return extractQuery(query[0], fallback);
    if (typeof query !== "string") return fallback;
    return query || fallback;
};

export const getAsset = (historyEvent: HistoryEvent): Asset => {
    return isAsset(historyEvent.transferParams.sendToken) ?
        historyEvent.transferParams.sendToken : parseRenContract((historyEvent.eventType === EventType.LockAndMint ? resolveInToken : resolveOutToken)(historyEvent.transferParams.sendToken)).asset;
};

export const renderChain = (chain: Chain): string => {
    switch (chain) {
        case Chain.Bitcoin:
            return "Bitcoin";
        case Chain.Ethereum:
            return "Ethereum";
        case Chain.Zcash:
            return "Zcash";
        case Chain.BitcoinCash:
            return "Bitcoin Cash";
    }
    return chain;
};
