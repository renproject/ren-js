import { retryNTimes, SECONDS } from "@renproject/utils";

import { GatewayTransaction, TransactionStatus } from "./gatewayTransaction";

/**
 * See [[RenJS.defaultDepositHandler]].
 */
const createDepositHandler = (retries = -1) => {
    const fn: ((gateway: GatewayTransaction) => Promise<void>) & {
        withRetries: (newRetries: number) => void;
    } = async (gateway: GatewayTransaction) => {
        // Loop until the deposit status is `Submitted`.
        while (gateway.status !== TransactionStatus.Submitted) {
            switch (gateway.status) {
                // The deposit has been seen, but not enough confirmations have
                // passed yet.
                case TransactionStatus.Detected:
                    await retryNTimes(
                        async () => {
                            gateway._config.logger.log(`Calling .confirmed`);
                            await gateway.in
                                .confirmed()
                                .on("target", (target) => {
                                    gateway._config.logger.log(
                                        `Waiting for ${target} confirmations`,
                                    );
                                })
                                .on("confirmation", (confs, target) => {
                                    gateway._config.logger.log(
                                        `${confs}/${target} confirmations`,
                                    );
                                });
                        },
                        retries,
                        10 * SECONDS,
                        gateway._config.logger,
                    );
                    break;

                // The deposit as been seen and confirmed, but it hasn't been
                // signed by RenVM yet.
                case TransactionStatus.Confirmed:
                    await retryNTimes(
                        async () => {
                            try {
                                gateway._config.logger.log(`Calling .signed`);
                                await gateway
                                    .signed()
                                    .on("txHash", (status) => {
                                        gateway._config.logger.log(
                                            `RenVM hash: ${status}`,
                                        );
                                    })
                                    .on("status", (status) => {
                                        gateway._config.logger.log(
                                            `status: ${status}`,
                                        );
                                    });
                            } catch (error) {
                                if (
                                    gateway.status ===
                                    TransactionStatus.Reverted
                                ) {
                                    return;
                                }
                                throw error;
                            }
                        },
                        retries,
                        10 * SECONDS,
                        gateway._config.logger,
                    );
                    break;

                // The mint has been signed by RenVM and can be submitted to
                // the mint-chain.
                case TransactionStatus.Signed:
                    await retryNTimes(
                        async () => {
                            try {
                                gateway._config.logger.log(`Calling .mint`);
                                const transaction = await gateway.out.submit();
                                gateway._config.logger.log(
                                    `txHash: ${gateway.params.toChain.transactionExplorerLink(
                                        transaction,
                                    )}`,
                                );
                            } catch (error: any) {
                                // Ethereum revert message.
                                if (
                                    /(execution reverted)|(Transaction has been reverted)/.exec(
                                        error.message || String(error),
                                    )
                                ) {
                                    gateway.status = TransactionStatus.Reverted;
                                    gateway.revertReason =
                                        error.message || String(error);
                                    return;
                                }
                                throw error;
                            }
                        },
                        retries,
                        10 * SECONDS,
                        gateway._config.logger,
                    );
                    break;

                // RenVM wasn't able to sign the mint. Potential causes can be
                // found in `deposit.revertReason`.
                case TransactionStatus.Reverted:
                    throw new Error(
                        `RenVM transaction reverted${
                            gateway.revertReason
                                ? ": " + gateway.revertReason
                                : ""
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
