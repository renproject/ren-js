import {
    ChainTransactionStatus,
    ErrorWithCode,
    RenJSError,
    TxSubmitter,
    TxWaiter,
    utils,
} from "@renproject/utils";

import { GatewayTransaction } from "../gatewayTransaction";

const chainTransactionHandler = async (
    tx: TxWaiter | TxSubmitter,
    {
        retries = 1,
    }: {
        retries?: number;
    } = {},
) => {
    while (true) {
        switch (tx.progress.status) {
            case ChainTransactionStatus.Ready:
                if (!tx.submit) {
                    throw new ErrorWithCode(
                        `${tx.chain} transaction doesn't have a submit handler.`,
                        RenJSError.PARAMETER_ERROR,
                    );
                }
                await utils.tryNTimes(async (i: number) => {
                    try {
                        tx.submit && (await tx.submit());
                    } catch (error: unknown) {
                        // Log error every 10 attempts.
                        if ((i + 1) % 10 === 0) {
                            console.error(error);
                        }
                        throw error;
                    }
                }, retries);
                break;
            case ChainTransactionStatus.Confirming:
                await new Promise((resolve, reject) =>
                    resolve(
                        utils.tryNTimes(async (i: number) => {
                            try {
                                await tx.wait();
                            } catch (error: unknown) {
                                if (
                                    ErrorWithCode.isErrorWithCode(error) &&
                                    error.code ===
                                        RenJSError.CHAIN_TRANSACTION_REVERTED
                                ) {
                                    reject(error);
                                    throw error;
                                }
                                // Log error every 10 attempts.
                                if ((i + 1) % 10 === 0) {
                                    console.error(error);
                                }
                                throw error;
                            }
                        }, retries),
                    ),
                );
                break;
            case ChainTransactionStatus.Reverted:
                throw new ErrorWithCode(
                    `${tx.chain} transaction reverted${
                        tx.progress.revertReason
                            ? ` with reason: ${tx.progress.revertReason}`
                            : ``
                    }`,
                    tx.chain === "RenVM"
                        ? RenJSError.RENVM_TRANSACTION_REVERTED
                        : RenJSError.CHAIN_TRANSACTION_REVERTED,
                );
            case ChainTransactionStatus.Done:
                return;
        }
    }
};

/**
 * See [[RenJS.defaultTransactionHandler]].
 */
const createTransactionHandler = (retries = -1) => {
    const fn: ((tx: GatewayTransaction) => Promise<void>) & {
        withRetries: (newRetries: number) => void;
    } = async (tx: GatewayTransaction): Promise<void> => {
        await chainTransactionHandler(tx.in, { retries });
        await chainTransactionHandler(tx.renVM, { retries });
        for (const setupKey of Object.keys(tx.outSetup || {})) {
            await chainTransactionHandler(tx.outSetup[setupKey], { retries });
        }
        await chainTransactionHandler(tx.out, { retries });
    };

    fn.withRetries = (newRetries: number) =>
        createTransactionHandler(newRetries);
    return fn;
};

/**
 * See [[RenJS.defaultTransactionHandler]].
 */
export const defaultTransactionHandler = createTransactionHandler();
