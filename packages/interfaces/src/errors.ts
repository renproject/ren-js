// RenJS error codes. Chain classes have their own error codes.
export enum RenJSErrors {
    RenVMTransactionNotFound = "REN_RENVM_TRANSACTION_NOT_FOUND",
    DepositSpentOrNotFound = "REN_DEPOSIT_SPENT_OR_NOT_FOUND",
    AmountTooSmall = "REN_AMOUNT_TOO_SMALL",
}

/**
 * An ErrorWithCode is an Error instance with an additional `code` field.
 * Because this is a common pattern with various implementations provided
 * by libraries, checking if an Error is an ErrorWithCode should be done using
 * `isErrorWithCode(error)` instead of `error instanceof ErrorWithCode`.
 */
export class ErrorWithCode extends Error {
    code: string;

    /**
     * @param message An error message, passed on to the Error constructor.
     * @param code An error code, defined in a standard manner to allow for
     * easier error handling.
     */
    constructor(message: string, code: string) {
        super(message);
        this.code = code;
    }
}

/**
 * Check if the provided value is an Error instance and has a code field which
 * contains a string.
 */
export const isErrorWithCode = (error: unknown): error is ErrorWithCode =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error instanceof Error && typeof (error as any).code === "string";

/**
 * Add an error code to an existing Error instance.
 */
export const addCodeToError = (error: Error, code: string): ErrorWithCode => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).code = code;
    return error as ErrorWithCode;
};
