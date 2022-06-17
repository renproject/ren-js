import { extractError } from "./internal/extractError";

/**
 * RenJS error codes - errors thrown from RenJS are in the process of being
 * converted to `ErrorWithCode` errors with the following error codes.
 */
export enum RenJSError {
    // General errors.
    UNKNOWN_ERROR = "RENJS:UNKNOWN_ERROR",
    NOT_IMPLEMENTED = "RENJS:NOT_IMPLEMENTED",
    PARAMETER_ERROR = "RENJS:PARAMETER_ERROR",
    INTERNAL_ERROR = "RENJS:INTERNAL_ERROR",
    NETWORK_ERROR = "RENJS:NETWORK_ERROR",
    SIGNER_ERROR = "RENJS:SIGNER_ERROR",

    TRANSACTION_NOT_FOUND = "RENJS:TRANSACTION_NOT_FOUND",

    // Indicates that the RenVM transaction has returned with a Reverted status
    // and a revert reason. A reverted transaction cannot be re-submitted.
    RENVM_TRANSACTION_REVERTED = "RENJS:RENVM_TRANSACTION_REVERTED",

    // Indicates that the chain transaction reverted. It may be possible to
    // resubmit the transaction.
    CHAIN_TRANSACTION_REVERTED = "RENJS:CHAIN_TRANSACTION_REVERTED",

    // Indicates that submitting the gateway details failed.
    GATEWAY_SUBMISSION_FAILED = "RENJS:GATEWAY_SUBMISSION_FAILED",

    INCORRECT_PROVIDER_NETWORK = "RENJS:INCORRECT_PROVIDER_NETWORK",
    INCORRECT_SIGNER_NETWORK = "RENJS:INCORRECT_SIGNER_NETWORK",
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
    public static updateError = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: any,
        code: string,
        errorPrefix?: string,
    ): ErrorWithCode => {
        // Check the code passed in is a RenJS error. If it isn't, it may have
        // been set by a dependency.
        if (typeof code !== "string" || code.slice(0, 6) !== "RENJS:") {
            code = RenJSError.INTERNAL_ERROR;
        }
        if (error instanceof Error) {
            (error as unknown as ErrorWithCode).code = code;
            if (errorPrefix) {
                error.message = `${errorPrefix}: ${extractError(error)}`;
            }
            return error as ErrorWithCode;
        } else {
            const message = extractError(error);
            return new ErrorWithCode(
                errorPrefix && message
                    ? `${errorPrefix}: ${message}}`
                    : errorPrefix || message,
                code,
            );
        }
    };

    /**
     * @param message An error message, passed on to the Error constructor.
     * @param code An error code, defined in a standard manner to allow for
     * easier error handling.
     */
    public constructor(message: unknown, code: string, prefix?: string) {
        super(
            prefix
                ? `${prefix}: ${extractError(message)}`
                : extractError(message),
        );
        this.code = code;
    }
}
