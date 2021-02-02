import { retryNTimes, SECONDS } from "@renproject/utils";

import { DepositStatus, LockAndMintDeposit } from "./lockAndMint";

/**
 * See [[RenJS.defaultDepositHandler]].
 */
const createDepositHandler = (retries = -1) => {
    const fn: ((deposit: LockAndMintDeposit) => Promise<void>) & {
        withRetries: (newRetries: number) => void;
    } = async (deposit: LockAndMintDeposit) => {
        // Loop until the deposit status is `Submitted`.
        while (deposit.status !== DepositStatus.Submitted) {
            switch (deposit.status) {
                // The deposit has been seen, but not enough confirmations have
                // passed yet.
                case DepositStatus.Detected:
                    await retryNTimes(
                        async () => {
                            deposit._state.logger.log(`Calling .confirmed`);
                            await deposit
                                .confirmed()
                                .on("target", (target) => {
                                    deposit._state.logger.log(
                                        `Waiting for ${target} confirmations`,
                                    );
                                })
                                .on("confirmation", (confs, target) => {
                                    deposit._state.logger.log(
                                        `${confs}/${target} confirmations`,
                                    );
                                });
                        },
                        retries,
                        10 * SECONDS,
                        deposit._state.logger,
                    );
                    break;

                // The deposit as been seen and confirmed, but it hasn't been
                // signed by RenVM yet.
                case DepositStatus.Confirmed:
                    await retryNTimes(
                        async () => {
                            try {
                                deposit._state.logger.log(`Calling .signed`);
                                await deposit
                                    .signed()
                                    .on("txHash", (status) => {
                                        deposit._state.logger.log(
                                            `RenVM hash: ${status}`,
                                        );
                                    })
                                    .on("status", (status) => {
                                        deposit._state.logger.log(
                                            `status: ${status}`,
                                        );
                                    });
                            } catch (error) {
                                if (deposit.status === DepositStatus.Reverted) {
                                    return;
                                }
                                throw error;
                            }
                        },
                        retries,
                        10 * SECONDS,
                        deposit._state.logger,
                    );
                    break;

                // The mint has been signed by RenVM and can be submitted to
                // the mint-chain.
                case DepositStatus.Signed:
                    await retryNTimes(
                        async () => {
                            try {
                                deposit._state.logger.log(`Calling .mint`);
                                await deposit
                                    .mint({
                                        _extraMsg: "test", // Override value.
                                    })
                                    .on("transactionHash", (txHash) => {
                                        deposit._state.logger.log(
                                            `txHash: ${
                                                deposit.params.to.utils
                                                    .transactionExplorerLink
                                                    ? deposit.params.to.utils.transactionExplorerLink(
                                                          txHash,
                                                      ) || String(txHash)
                                                    : String(txHash)
                                            }`,
                                        );
                                    });
                            } catch (error) {
                                // Ethereum revert message.
                                if (
                                    /execution reverted/.exec(
                                        error.message || String(error),
                                    )
                                ) {
                                    deposit.status = DepositStatus.Reverted;
                                    deposit.revertReason =
                                        error.message || String(error);
                                    return;
                                }
                                throw error;
                            }
                        },
                        retries,
                        10 * SECONDS,
                        deposit._state.logger,
                    );
                    break;

                // RenVM wasn't able to sign the mint. Potential causes can be
                // found in `deposit.revertReason`.
                case DepositStatus.Reverted:
                    throw new Error(
                        `RenVM transaction reverted${
                            deposit.revertReason
                                ? ": " + deposit.revertReason
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
