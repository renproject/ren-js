import Axios from "axios";
import BigNumber from "bignumber.js";

import { retryNTimes } from "../lib/utils";

export const getUTXOs = <T>(endpoint: string, network: string) => async (address: string, confirmations: number): Promise<T[]> => {
    const resp = await retryNTimes(
        () => Axios.get<T[]>(`${endpoint}/get_tx_unspent/${network}/${address}/${confirmations}`, { timeout: 10000 }),
        5,
    );
    // tslint:disable-next-line:no-any
    const data = (resp.data as any);

    // Convert value to Satoshi
    for (const [, tx] of Object.entries(data.data.txs)) {
        // tslint:disable-next-line:no-any
        (tx as any).value = new BigNumber((tx as any).value).times(new BigNumber(10).exponentiatedBy(8)).decimalPlaces(0).toNumber();
    }
    return data.data.txs;
};
