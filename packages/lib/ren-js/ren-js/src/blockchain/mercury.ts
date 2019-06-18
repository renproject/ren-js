import Axios from "axios";

export const getUTXOs = <T>(endpoint: string) => async (address: string, limit: number, confirmations: number): Promise<T[]> => {
    const resp = await Axios.get<T[]>(`${endpoint}/utxo/${address}?limit=${limit}&confirmations=${confirmations}`);
    return resp.data;
};
