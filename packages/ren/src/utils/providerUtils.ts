import {
    CrossChainTxResponse,
    RenVMProvider,
    TxResponseWithStatus,
} from "@renproject/provider";
import {
    assertType,
    isDefined,
    Logger,
    SECONDS,
    sleep,
    TxStatus,
} from "@renproject/utils";

/**
 * Fetches the result of a RenVM transaction on a repeated basis until the
 * transaction's status is `"done"`.
 *
 * @param utxoTxHash The transaction hash as a Buffer.
 * @param onStatus A callback called each time the status of the transaction
 * is refreshed - even if it hasn't changed.
 * @param _cancelRequested A function that returns `true` to cancel the
 * loop.
 */
export const waitForTX = async (
    renVM: RenVMProvider,
    utxoTxHash: Buffer,
    onStatus?: (status: TxStatus) => void,
    _cancelRequested?: () => boolean,
    timeout?: number,
    logger?: Logger,
): Promise<TxResponseWithStatus<CrossChainTxResponse>> => {
    assertType<Buffer>("Buffer", { utxoTxHash });
    let rawResponse: TxResponseWithStatus<CrossChainTxResponse>;
    while (true) {
        if (_cancelRequested && _cancelRequested()) {
            throw new Error(`waitForTX cancelled.`);
        }

        try {
            const result = await renVM.queryTransaction(utxoTxHash);
            if (result && result.txStatus === TxStatus.TxStatusDone) {
                rawResponse = result;
                break;
            } else if (onStatus && result && result.txStatus) {
                onStatus(result.txStatus);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (
                /(not found)|(not available)/.exec(
                    String((error || {}).message),
                )
            ) {
                // ignore
            } else {
                if (logger) {
                    logger.error(String(error));
                }
                // TODO: throw unexpected errors
            }
        }
        await sleep(isDefined(timeout) ? timeout : 15 * SECONDS);
    }
    return rawResponse;
};
