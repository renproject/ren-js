import Axios from "axios";

export const getUTXOs = <T>(endpoint: string, network: string) => async (address: string, confirmations: number): Promise<T[]> => {
    const resp = await Axios.get<T[]>(`${endpoint}/get_tx_unspent/${network}/${address}/${confirmations}`);
    // tslint:disable-next-line:no-any
    const data = (resp.data as any);

    // Convert value to Satoshi
    for (const [, tx] of Object.entries(data.data.txs)) {
        // tslint:disable-next-line:no-any
        (tx as any).value = (tx as any).value * (10 ** 8); // TODO: Use BN
    }
    return data.data.txs;
};
