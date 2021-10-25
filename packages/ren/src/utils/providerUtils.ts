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
    SyncOrPromise,
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
    selector: string,
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
            const result = await renVM.queryTransaction(selector, utxoTxHash);
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

export const getRenVMSelector = async ({
    asset,
    from,
    to,
}: {
    asset: string;
    from: {
        chain: string;
        assetIsNative: (asset: string) => SyncOrPromise<boolean>;
    };
    to: {
        chain: string;
        assetIsNative: (asset: string) => SyncOrPromise<boolean>;
    };
}): Promise<string> => {
    if (await from.assetIsNative(asset)) {
        return `${asset}/to${to.chain}`;
    }
    if (await to.assetIsNative(asset)) {
        return `${asset}/from${from.chain}`;
    }
    return `${asset}/from${from.chain}To${to.chain}`;
};
