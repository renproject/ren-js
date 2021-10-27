import { isDefined, SECONDS, tryNTimes } from "@renproject/utils";

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
                    await tryNTimes(
                        async () => {
                            gateway._config.logger.debug(`Calling .confirmed`);
                            await gateway.in.wait().on("status", (status) => {
                                if (isDefined(status.confirmations)) {
                                    gateway._config.logger.debug(
                                        `${status.confirmations}/${status.target} confirmations`,
                                    );
                                } else {
                                    gateway._config.logger.debug(
                                        `Waiting for ${status.target} confirmations...`,
                                    );
                                }
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
                    await tryNTimes(
                        async () => {
                            try {
                                gateway._config.logger.debug(`Calling .signed`);
                                await gateway
                                    .signed()
                                    .on("txHash", (status) => {
                                        gateway._config.logger.debug(
                                            `RenVM hash: ${status}`,
                                        );
                                    })
                                    .on("status", (status) => {
                                        gateway._config.logger.debug(
                                            `status: ${status}`,
                                        );
                                    });
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            } catch (error: any) {
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
                    await tryNTimes(
                        async () => {
                            try {
                                gateway._config.logger.debug(`Calling .mint`);
                                if (!gateway.out) {
                                    return;
                                }
                                if (gateway.out.submit) {
                                    await gateway.out.submit();
                                }
                                await gateway.out.wait();
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
