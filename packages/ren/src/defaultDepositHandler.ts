import { isDefined, SECONDS, tryNTimes } from "@renproject/utils";

import { GatewayTransaction, TransactionStatus } from "./gatewayTransaction";

/**
 * See [[RenJS.defaultDepositHandler]].
 */
const createDepositHandler = (retries = -1) => {
    const fn: ((gateway: GatewayTransaction) => Promise<void>) & {
        withRetries: (newRetries: number) => void;
    } = async (tx: GatewayTransaction) => {
        await tx.fetchStatus();

        // Loop until the deposit status is `Submitted`.
        while (tx.status !== TransactionStatus.Submitted) {
            switch (tx.status) {
                // The deposit has been seen, but not enough confirmations have
                // passed yet.
                case TransactionStatus.Detected:
                    await tryNTimes(
                        async () => {
                            tx._config.logger.debug(`Calling .confirmed`);
                            tx.in.eventEmitter.on("status", (status) => {
                                if (isDefined(status.confirmations)) {
                                    tx._config.logger.debug(
                                        `${status.confirmations}/${status.target} confirmations`,
                                    );
                                } else {
                                    tx._config.logger.debug(
                                        `Waiting for ${status.target} confirmations...`,
                                    );
                                }
                            });
                            await tx.in.wait();
                        },
                        retries,
                        10 * SECONDS,
                        tx._config.logger,
                    );
                    break;

                // The deposit as been seen and confirmed, but it hasn't been
                // signed by RenVM yet.
                case TransactionStatus.Confirmed:
                    await tryNTimes(
                        async () => {
                            try {
                                tx._config.logger.debug(`Calling .signed`);
                                tx.renVM.eventEmitter.on("status", (status) => {
                                    tx._config.logger.debug(
                                        `status: ${status}`,
                                    );
                                });

                                await tx.renVM.submit();
                                await tx.renVM.wait();

                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            } catch (error: any) {
                                if (tx.status === TransactionStatus.Reverted) {
                                    return;
                                }
                                throw error;
                            }
                        },
                        retries,
                        10 * SECONDS,
                        tx._config.logger,
                    );
                    break;

                // The mint has been signed by RenVM and can be submitted to
                // the mint-chain.
                case TransactionStatus.Signed:
                    await tryNTimes(
                        async () => {
                            try {
                                tx._config.logger.debug(`Calling .mint`);
                                if (!tx.out) {
                                    return;
                                }
                                if (tx.out.submit) {
                                    await tx.out.submit();
                                }
                                await tx.out.wait();
                                // gateway._config.logger.debug(
                                //     `txHash: ${
                                //         gateway.params.toChain.transactionExplorerLink(
                                //             transaction,
                                //         ) || ""
                                //     }`,
                                // );
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            } catch (error: any) {
                                // Ethereum revert message.
                                if (
                                    /(execution reverted)|(Transaction has been reverted)/.exec(
                                        error.message || String(error),
                                    )
                                ) {
                                    tx.status = TransactionStatus.Reverted;
                                    tx.revertReason =
                                        error.message || String(error);
                                    return;
                                }
                                throw error;
                            }
                        },
                        retries,
                        10 * SECONDS,
                        tx._config.logger,
                    );
                    break;

                // RenVM wasn't able to sign the mint. Potential causes can be
                // found in `deposit.revertReason`.
                case TransactionStatus.Reverted:
                    throw new Error(
                        `RenVM transaction reverted${
                            tx.revertReason ? ": " + tx.revertReason : ""
                        }`,
                    );
            }
        }
    };

    fn.withRetries = (newRetries: number) => createDepositHandler(newRetries);
    return fn;
};

/**
 * See [[RenJS.defaultDepositHandler]].
 */
export const defaultDepositHandler = createDepositHandler();
