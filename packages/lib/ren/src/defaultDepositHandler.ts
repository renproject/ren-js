import { retryNTimes, SECONDS } from "@renproject/utils";

import { LockAndMintDeposit } from "./lockAndMint";

/**
 * See [[RenJS.defaultDepositHandler]].
 */
const createDepositHandler = (retries = -1) => {
    const fn: ((deposit: LockAndMintDeposit) => Promise<void>) & {
        withRetries: (newRetries: number) => void;
    } = async (deposit: LockAndMintDeposit) => {
        await retryNTimes(
            async () => {
                deposit._state.logger.log(`Calling .confirmed`);
                await deposit
                    .confirmed()
                    .on("target", (confs, target) => {
                        deposit._state.logger.log(
                            `${confs}/${target} confirmations`,
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
        );

        await retryNTimes(
            async () => {
                deposit._state.logger.log(`Calling .signed`);
                await deposit.signed().on("status", (status) => {
                    deposit._state.logger.log(`status: ${status}`);
                });
            },
            retries,
            10 * SECONDS,
        );

        await retryNTimes(
            async () => {
                deposit._state.logger.log(`Calling .mint`);
                await deposit
                    .mint({
                        _extraMsg: "test", // Override value.
                    })
                    .on("transactionHash", (txHash) => {
                        deposit._state.logger.log(`txHash: ${String(txHash)}`);
                    });
            },
            retries,
            10 * SECONDS,
        );
    };

    fn.withRetries = (newRetries: number) => createDepositHandler(newRetries);
    return fn;
};

/**
 * See [[RenJS.defaultDepositHandler]].
 */
export const defaultDepositHandler = createDepositHandler();
