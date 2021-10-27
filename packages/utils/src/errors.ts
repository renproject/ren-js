// RenJS error codes. Chain classes have their own error codes.
export enum RenJSError {
    // General errors.
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
    INVALID_PARAMETERS = "INVALID_PARAMETERS",
    INTERNAL_ERROR = "INTERNAL_ERROR",

    TRANSACTION_NOT_FOUND = "RENVM_TRANSACTION_NOT_FOUND",
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
export const withCode = (error: Error, code: string): ErrorWithCode => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).code = code;
    return error as ErrorWithCode;
};

const hasOwnProperty = <T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any,
    property: keyof T,
): object is T => object.hasOwnProperty(property);

const invalidError = (errorMessage: string) =>
    errorMessage === "" ||
    errorMessage === "null" ||
    errorMessage === "undefined";

/**
 * Attempt to extract a more meaningful error from a thrown error, such as
 * the body of a network response.
 */
export const extractError = (error: unknown): string => {
    if (error && typeof error === "object") {
        if (hasOwnProperty(error, "response") && error.response) {
            const extractedError = extractError(error.response);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
        if (hasOwnProperty(error, "data") && error.data) {
            const extractedError = extractError(error.data);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
        if (hasOwnProperty(error, "error") && error.error) {
            const extractedError = extractError(error.error);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
        if (hasOwnProperty(error, "context") && error.context) {
            const extractedError = extractError(error.context);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
        if (hasOwnProperty(error, "message") && error.message) {
            const extractedError = extractError(error.message);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
        if (hasOwnProperty(error, "statusText") && error.statusText) {
            const extractedError = extractError(error.statusText);
            if (!invalidError(extractedError)) {
                return extractedError;
            }
        }
    }
    try {
        if (typeof error === "string") {
            if (error.slice(0, 7) === "Error: ") {
                error = error.slice(7);
            }
            return error as string;
        }
        return JSON.stringify(error);
    } catch (innerError) {
        // Ignore JSON error
    }
    return String(error);
};
