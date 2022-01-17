/**
 * RenJS error codes - errors thrown from RenJS are in the process of being
 * converted to `ErrorWithCode` errors with the following error codes.
 */
export enum RenJSError {
    // General errors.
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
    PARAMETER_ERROR = "PARAMETER_ERROR",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    NETWORK_ERROR = "NETWORK_ERROR",

    TRANSACTION_NOT_FOUND = "TRANSACTION_NOT_FOUND",

    // Indicates that the RenVM transaction has returned with a Reverted status
    // and a revert reason. A reverted transaction cannot be re-submitted.
    RENVM_TRANSACTION_REVERTED = "RENVM_TRANSACTION_REVERTED",

    // Indicates that the chain transaction reverted. It may be possible to
    // resubmit the transaction.
    CHAIN_TRANSACTION_REVERTED = "CHAIN_TRANSACTION_REVERTED",

    // Indicates that submitting the gateway details failed.
    GATEWAY_SUBMISSION_FAILED = "GATEWAY_SUBMISSION_FAILED",
}

/**
 * An ErrorWithCode is an Error instance with an additional `code` field.
 * Because this is a common pattern with various implementations provided
 * by libraries, checking if an Error is an ErrorWithCode should be done using
 * `isErrorWithCode(error)` instead of `error instanceof ErrorWithCode`.
 */
export class ErrorWithCode extends Error {
    public code: string;

    /**
     * Check if the provided value is an Error instance and has a code field which
     * contains a string.
     */
    public static isErrorWithCode = (error: unknown): error is ErrorWithCode =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error instanceof Error && typeof (error as any).code === "string";

    /**
     * Add an error code to an existing Error instance.
     */
    public static from = (error: Error, code: string): ErrorWithCode => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).code = code;
        return error as ErrorWithCode;
    };

    /**
     * @param message An error message, passed on to the Error constructor.
     * @param code An error code, defined in a standard manner to allow for
     * easier error handling.
     */
    public constructor(message: string, code: string) {
        super(message);
        this.code = code;
    }
}
