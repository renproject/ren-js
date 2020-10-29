import Axios from "axios";

import { FilTransaction } from "./deposit";

// See https://github.com/renproject/account-chain-indexer
const INDEXER_URL = `https://account-chain-indexer.herokuapp.com/graphql`;

export const fetchDeposits = async (
    address: string,
    paramsFilterBase64: string | undefined = undefined,
    _page = 0,
): Promise<FilTransaction[]> => {
    // TODO: Add network parameter.
    const query = `{
        messages: FilecoinTransactions(to: "${address}", params: "${paramsFilterBase64}") {
            cid
            params
            to
            nonce
            blocknumber
            amount
        }

        height: NetworkHeight(chain: "Filecoin", network: "testnet")
    }`;

    const response = (
        await Axios.post<{
            errors?: Array<{ message: string }>;
            data: {
                messages: Array<{
                    cid: string;
                    params: string;
                    to: string;
                    nonce: number;
                    blocknumber: number;
                    amount: string;
                }>;
                height: number;
            };
        }>(INDEXER_URL, { query })
    ).data;

    if (response.errors && response.errors.length) {
        throw new Error(
            `Unable to fetch Filecoin messages: ${response.errors[0].message}`,
        );
    }

    const { messages, height } = response.data;

    return messages
        .map(
            (message): FilTransaction => {
                return {
                    cid: message.cid,
                    // to: message.to,
                    amount: message.amount,
                    params: message.params,
                    confirmations: height ? height - height + 1 : 0,
                    nonce: message.nonce,
                };
            },
        )
        .filter(
            (message) =>
                !paramsFilterBase64 || message.params === paramsFilterBase64,
        );
};

export const fetchMessage = async (cid: string): Promise<FilTransaction> => {
    // TODO: Add network parameter.
    const query = `{
        messages: FilecoinTransactions(cid: "${cid}") {
            cid
            params
            to
            nonce
            blocknumber
            amount
        }

        height: NetworkHeight(chain: "Filecoin", network: "testnet")
    }`;

    const response = (
        await Axios.post<{
            errors?: Array<{ message: string }>;
            data: {
                messages: Array<{
                    cid: string;
                    params: string;
                    to: string;
                    nonce: number;
                    blocknumber: number;
                    amount: string;
                }>;
                height: number;
            };
        }>(INDEXER_URL, { query })
    ).data;

    if (response.errors && response.errors.length) {
        throw new Error(
            `Unable to fetch Filecoin messages: ${response.errors[0].message}`,
        );
    }

    const { messages, height } = response.data;

    if (messages.length === 0) {
        throw new Error(
            `Error fetching Filecoin transaction: message not found.`,
        );
    }

    if (messages.length > 0) {
        console.warn(
            `More than Filecoin transaction found with the same transaction ID.`,
        );
    }

    const message = messages[0];

    return {
        cid: message.cid,
        // to: message.to,
        amount: message.amount,
        params: message.params,
        confirmations: message.blocknumber
            ? height - message.blocknumber + 1
            : 0,
        nonce: message.nonce,
    };
};
