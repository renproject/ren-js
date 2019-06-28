import Axios from "axios";
import { BN } from "ethereumjs-util";

export const getUTXOs = <T>(endpoint: string, network: string) => async (address: string, confirmations: number): Promise<T[]> => {
    const resp = await Axios.get<T[]>(`${endpoint}/get_tx_unspent/${network}/${address}/${confirmations}`);
    // tslint:disable-next-line:no-any
    const data = (resp.data as any);

    // Convert value to Satoshi
    for (const tx of data.txs) {
        tx.value = new BN(tx.value).mul(new BN(10).pow(new BN(8))).toNumber();
    }
    return data.data.txs;
};
