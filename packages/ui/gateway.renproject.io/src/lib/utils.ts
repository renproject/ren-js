import { ShiftInStatus, ShiftOutStatus, TxStatus } from "@renproject/ren-js-common";

// tslint:disable-next-line: no-any
export const isPromise = <T>(p: any): p is Promise<T> => {
    return p.hasOwnProperty("then");
};

// tslint:disable-next-line: no-any ban-types
export const isFunction = (p: any): p is Function => {
    return typeof p === "function";
};

export const range = (left: number, right?: number) => {
    const start = right === undefined ? 0 : left;
    const end = right === undefined ? left : right;
    return Array.from(new Array(end - start)).map((_, i) => i + start);
};

export const classNames = (...args: Array<string | undefined>) => {
    return args.filter(arg => arg !== undefined).join(" ");
};

const maxBy = <T>(fn: (t: T) => number, rest: T[]): T => {
    return rest.slice(1).reduce((acc, next) => fn(next) > fn(acc) ? next : acc, rest[0]);
};

export const compareTxStatus = (...statuses: Array<TxStatus | undefined | null>): TxStatus | undefined => {
    return maxBy(
        (status: { status: TxStatus | undefined, index: number }) => status.index,
        statuses.map(status => {
            switch (status) {
                case null: return { status: undefined, index: -1 };
                case undefined: return { status, index: -1 };
                case TxStatus.TxStatusNil: return { status, index: 0 };
                case TxStatus.TxStatusConfirming: return { status, index: 1 };
                case TxStatus.TxStatusPending: return { status, index: 2 };
                case TxStatus.TxStatusExecuting: return { status, index: 3 };
                case TxStatus.TxStatusDone: return { status, index: 4 };
                case TxStatus.TxStatusReverted: return { status, index: 5 };
            }
        }),
    ).status;
};

export const compareShiftStatus = (...statuses: Array<ShiftInStatus | ShiftOutStatus | undefined | null>): ShiftInStatus | ShiftOutStatus | undefined => {
    return maxBy(
        (status: { status: ShiftInStatus | ShiftOutStatus | undefined, index: number }) => status.index,
        statuses.map(status => {
            switch (status) {
                case null: return { status: undefined, index: -1 };
                case undefined: return { status, index: -1 };
                case ShiftInStatus.Committed: return { status, index: 0 };
                case ShiftInStatus.Deposited: return { status, index: 1 };
                case ShiftInStatus.Confirmed: return { status, index: 2 };
                case ShiftInStatus.SubmittedToRenVM: return { status, index: 3 };
                case ShiftInStatus.ReturnedFromRenVM: return { status, index: 4 };
                case ShiftInStatus.SubmittedToEthereum: return { status, index: 5 };
                case ShiftInStatus.ConfirmedOnEthereum: return { status, index: 6 };

                case ShiftOutStatus.Committed: return { status, index: 0 };
                case ShiftOutStatus.SubmittedToEthereum: return { status, index: 1 };
                case ShiftOutStatus.ConfirmedOnEthereum: return { status, index: 2 };
                case ShiftOutStatus.SubmittedToRenVM: return { status, index: 3 };
                case ShiftOutStatus.ReturnedFromRenVM: return { status, index: 4 };
                case ShiftOutStatus.NoBurnFound: return { status, index: 5 };
            }
        }),
    ).status;
};
