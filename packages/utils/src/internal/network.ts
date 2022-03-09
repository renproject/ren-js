import Axios, { AxiosRequestConfig } from "axios";
import { extractError, sleep } from "./common";

// Default timeout for network requests.
export const DEFAULT_TIMEOUT = 30 * sleep.SECONDS;

export const GET = async <T = unknown, D = any>(
    url: string,
    config?: AxiosRequestConfig<D>,
): Promise<T> => {
    try {
        const response = await Axios.get<T>(url, {
            timeout: DEFAULT_TIMEOUT,
            ...config,
        });

        return response.data;
    } catch (error) {
        throw new Error(extractError(error));
    }
};

export const POST = async <T = unknown, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
): Promise<T> => {
    try {
        const response = await Axios.post<T>(url, data, {
            timeout: DEFAULT_TIMEOUT,
            ...config,
        });

        return response.data;
    } catch (error) {
        throw new Error(extractError(error));
    }
};
