import {
    ChainTransactionStatus,
    ErrorWithCode,
    RenJSError,
    TxSubmitter,
    TxWaiter,
    utils,
} from "@renproject/utils";

import { GatewayTransaction } from "./gatewayTransaction";

const defaultTransactionHandler = async (
    tx: TxWaiter | TxSubmitter,
    retries: number = -1,
) => {
    while (true) {
        switch (tx.status.status) {
            case ChainTransactionStatus.Ready:
                if (!tx.submit) {
                    throw new ErrorWithCode(
                        `${tx.chain} transaction doesn't have a submit handler.`,
                        RenJSError.PARAMETER_ERROR,
                    );
                }
                await utils.tryNTimes(async () => {
                    await tx.submit!();
                }, retries);
                break;
            case ChainTransactionStatus.Confirming:
                await utils.tryNTimes(async () => {
                    await tx.wait();
                }, retries);
                break;
            case ChainTransactionStatus.Reverted:
                throw new ErrorWithCode(
                    `${tx.chain} transaction reverted${
                        tx.status.revertReason
                            ? ` with reason: ${tx.status.revertReason}`
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
 * See [[RenJS.defaultDepositHandler]].
 */
const createDepositHandler = (retries = -1) => {
    const fn: ((tx: GatewayTransaction) => Promise<void>) & {
        withRetries: (newRetries: number) => void;
    } = async (tx: GatewayTransaction): Promise<void> => {
        await defaultTransactionHandler(tx.in, retries);
        await defaultTransactionHandler(tx.renVM, retries);
        for (const setupKey of Object.keys(tx.outSetup || {})) {
            await defaultTransactionHandler(tx.outSetup[setupKey], retries);
        }
        await defaultTransactionHandler(tx.out, retries);
    };

    fn.withRetries = (newRetries: number) => createDepositHandler(newRetries);
    return fn;
};

/**
 * See [[RenJS.defaultDepositHandler]].
 */
export const defaultDepositHandler = createDepositHandler();
