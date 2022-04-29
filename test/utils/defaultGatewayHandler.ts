import { Gateway } from "packages/ren/src";
import {
    ChainCommon,
    ChainTransactionStatus,
    Logger,
    utils,
} from "packages/utils/src";

import { printChain, sendFunds } from "./testUtils";

export const defaultGatewayHandler = async (
    gateway: Gateway,
    logger: Logger = console,
): Promise<void> => {
    const asset = gateway.params.asset;
    const from = gateway.fromChain;
    const to = gateway.toChain;

    // const decimalsOnFromChain = await (from as ChainCommon).assetDecimals(
    //     asset,
    // );
    // const decimalsOnToChain = await (to as ChainCommon).assetDecimals(asset);
    // // No other way of getting proper decimals for burn-and-mints.
    // const nativeDecimals = Math.max(decimalsOnFromChain, decimalsOnToChain);
    const decimalsOnFromChain = 18;
    const decimalsOnToChain = 18;
    const nativeDecimals = 18;

    logger.log(
        `[${printChain(from.chain)}⇢${printChain(to.chain)}]: Fees: ${
            gateway.fees.variableFee / 100
        }% + ${gateway.fees.fixedFee
            .shiftedBy(-nativeDecimals)
            .toFixed()} ${asset}`,
    );

    const minimumAmount = gateway.fees.minimumAmount.shiftedBy(
        -decimalsOnFromChain,
    );
    const receivedAmount = gateway.fees
        .estimateOutput(gateway.fees.minimumAmount)
        .shiftedBy(-decimalsOnFromChain);

    try {
        logger.log(
            `[${printChain(gateway.fromChain.chain)}⇢${printChain(
                gateway.toChain.chain,
            )}]: ${asset} balance: ${(
                await from.getBalance(asset, undefined as any)
            )
                .shiftedBy(-decimalsOnFromChain)
                .toFixed(4)} ${asset} on ${from.chain}`,
        );
    } catch (error) {
        // Ignore
    }

    try {
        logger.log(
            `[${printChain(gateway.toChain.chain)}⇢${printChain(
                gateway.toChain.chain,
            )}]: ${asset} balance: ${(
                await to.getBalance(asset, undefined as any)
            )
                .shiftedBy(-decimalsOnToChain)
                .toFixed(4)} ${asset} on ${to.chain}`,
        );
    } catch (error) {
        // Ignore
    }

    for (const setupKey of Object.keys(gateway.inSetup)) {
        const setup = gateway.inSetup[setupKey];
        logger.log(
            `[${printChain(gateway.fromChain.chain)}⇢${printChain(
                gateway.toChain.chain,
            )}]: Calling ${setupKey} setup for ${String(setup.chain)}`,
        );
        setup.eventEmitter.on("progress", (progress) =>
            logger.log(
                `[${printChain(gateway.params.from.chain)}⇢${printChain(
                    gateway.params.to.chain,
                )}]`,
                progress,
            ),
        );
        await utils.tryNTimes(async () => await setup.submit(), 2);
        await utils.tryNTimes(async () => await setup.wait(), 2);
    }

    if (gateway.in) {
        logger.log(
            `[${printChain(gateway.params.from.chain)}⇢${printChain(
                gateway.params.to.chain,
            )}]: Receiving ${receivedAmount.toFixed()} ${
                gateway.params.asset
            }.`,
        );
        logger.log(
            `[${printChain(gateway.params.from.chain)}⇢${printChain(
                gateway.params.to.chain,
            )}]: Submitting to ${printChain(gateway.params.from.chain, {
                pad: false,
            })}.`,
        );

        gateway.in.eventEmitter.on("progress", (progress) =>
            logger.log(
                `[${printChain(gateway.params.from.chain)}⇢${printChain(
                    gateway.params.to.chain,
                )}]`,
                progress,
            ),
        );
        await utils.tryIndefinitely(async () => await gateway.in.submit());
        // Wait for just 1 transaction for now - tx.in.wait() is called below.
        await utils.tryIndefinitely(async () => await gateway.in.wait(1));
    } else {
        logger.log(
            `Deposit at least ${minimumAmount.toFixed()} ${asset} to ${
                gateway.gatewayAddress
            } (to receive at least ${receivedAmount.toFixed()})`,
        );
        const SEND_FUNDS = false;
        if (SEND_FUNDS) {
            try {
                await sendFunds(
                    asset,
                    gateway.gatewayAddress,
                    minimumAmount.times(5),
                );
            } catch (error: unknown) {
                // logger.log(error.request);
                // logger.log(error.response);
                throw error;
            }
        } else {
            logger.log("Waiting for deposit...");
        }
    }

    let foundDeposits = 0;

    await new Promise<void>((resolve, reject) => {
        gateway.on("transaction", (tx) => {
            (async () => {
                foundDeposits += 1;
                logger.log(tx.in.progress.transaction);

                logger.log(
                    `[${printChain(from.chain)}⇢${printChain(to.chain)}][${
                        tx.hash
                    }] Detected:`,
                    tx.in.progress.transaction?.txidFormatted,
                );

                tx.in.eventEmitter.on("progress", (progress) =>
                    logger.log(
                        `[${printChain(tx.in.chain)}⇢${printChain(
                            tx.out.chain,
                        )}][${tx.hash.slice(0, 6)}]: ${
                            progress.confirmations || 0
                        }/${progress.target} confirmations`,
                    ),
                );

                while (true) {
                    try {
                        await tx.in.wait();
                        break;
                    } catch (error: unknown) {
                        logger.error(error);
                        if (
                            tx.in.progress.status ===
                            ChainTransactionStatus.Reverted
                        ) {
                            throw new Error(tx.in.progress.revertReason);
                        }
                        await utils.sleep(10 * utils.sleep.SECONDS);
                    }
                }

                tx.renVM.eventEmitter.on("progress", (progress) =>
                    logger.log(
                        `[${printChain(gateway.params.from.chain)}⇢${printChain(
                            gateway.params.to.chain,
                        )}][${tx.hash.slice(0, 6)}]: RenVM status: ${
                            progress.response?.txStatus
                        }`,
                    ),
                );

                logger.log("RenVM tx: ", tx.renVM.export());

                while (true) {
                    try {
                        await tx.renVM.submit();
                        await tx.renVM.wait();
                        break;
                    } catch (error: unknown) {
                        logger.log("RenVM tx: ", tx.renVM.export());
                        logger.error(error);
                        if (
                            tx.renVM.progress.status ===
                            ChainTransactionStatus.Reverted
                        ) {
                            throw new Error(tx.renVM.progress.revertReason);
                        }
                        await utils.sleep(10 * utils.sleep.SECONDS);
                    }
                }
                logger.log(
                    `[${printChain(tx.in.chain)}⇢${printChain(
                        tx.out.chain,
                    )}][${tx.hash.slice(0, 6)}]: Submitting to ${printChain(
                        tx.out.chain,
                        {
                            pad: false,
                        },
                    )}`,
                );

                tx.out.eventEmitter.on("progress", (progress) =>
                    logger.log(
                        `[${printChain(gateway.params.from.chain)}⇢${printChain(
                            gateway.params.to.chain,
                        )}]`,
                        progress,
                    ),
                );

                for (const setupKey of Object.keys(tx.outSetup)) {
                    const setup = tx.outSetup[setupKey];
                    logger.log(
                        `[${printChain(gateway.fromChain.chain)}⇢${printChain(
                            gateway.toChain.chain,
                        )}]: Calling ${setupKey} setup for ${String(
                            setup.chain,
                        )}`,
                    );
                    setup.eventEmitter.on("progress", (progress) =>
                        logger.log(
                            `[${printChain(
                                gateway.params.from.chain,
                            )}⇢${printChain(gateway.params.to.chain)}]`,
                            progress,
                        ),
                    );

                    await setup.submit();
                    await setup.wait();
                }

                console.log(await tx.out.export());

                if (tx.out.submit) {
                    await tx.out.submit();
                }

                while (true) {
                    try {
                        await tx.out.wait();
                        break;
                    } catch (error: unknown) {
                        logger.error(error);
                        if (
                            tx.out.progress.status ===
                            ChainTransactionStatus.Reverted
                        ) {
                            throw new Error(tx.out.progress.revertReason);
                        }
                        await utils.sleep(10 * utils.sleep.SECONDS);
                    }
                }

                foundDeposits -= 1;

                logger.log(
                    `[${printChain(from.chain)}⇢${printChain(
                        to.chain,
                    )}][${tx.hash.slice(
                        0,
                        6,
                    )}]: Done. (${foundDeposits} other deposits remaining)`,
                    tx.out.progress.transaction?.txidFormatted,
                );
                if (foundDeposits === 0) {
                    resolve();
                }
            })().catch(reject);
        });
    });
};
