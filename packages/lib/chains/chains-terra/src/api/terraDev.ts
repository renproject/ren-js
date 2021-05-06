import { SECONDS } from "@renproject/utils";
import Axios from "axios";

import { TerraAPI, TerraNetwork, TerraTransaction } from "./deposit";
import { getHeight } from "./height";

const TERRA_DEV_URL = (network: TerraNetwork) => {
    let prefix;
    switch (network) {
        case TerraNetwork.Columbus:
            prefix = "fcd";
            break;
        case TerraNetwork.Tequila:
            prefix = "tequila-fcd";
            break;
        default:
            throw new Error(`Terra network ${String(network)} not supported.`);
    }
    return `https://${String(prefix)}.terra.dev/v1`;
};

interface TerraDevTx {
    tx: {
        type: "core/StdTx";
        value: {
            fee: {
                gas: "69400";
                amount: [
                    {
                        denom: "uluna";
                        amount: "10410";
                    },
                ];
            };
            msg: [
                {
                    type: "bank/MsgSend";
                    value: {
                        amount: [
                            {
                                denom: "uluna";
                                amount: "100000000";
                            },
                        ];
                        to_address: "terra1muzv5awgfnavnelcc79c2rptp6jj085r7hsg7c";
                        from_address: "terra1muzv5awgfnavnelcc79c2rptp6jj085r7hsg7c";
                    };
                },
            ];
            memo: "test123";
            signatures: [
                {
                    pub_key: {
                        type: "tendermint/PubKeySecp256k1";
                        value: "AjthO041Lu27AySFNsQYgTLBYN6orpEdAjF21GbwRMD7";
                    };
                    signature: "czeRAxrQo8lagoGkEW3pFTOYSLG7/DvT2Q6COZVk//4eVVqADNjGiB/9LrgFRwO1DeP9zzeMIg9HMqRQwE+CZA==";
                },
            ];
        };
    };
    logs: [
        {
            log: {
                tax: "";
            };
            events: [
                {
                    type: "message";
                    attributes: [
                        {
                            key: "sender";
                            value: "terra1muzv5awgfnavnelcc79c2rptp6jj085r7hsg7c";
                        },
                        {
                            key: "module";
                            value: "bank";
                        },
                        {
                            key: "action";
                            value: "send";
                        },
                    ];
                },
                {
                    type: "transfer";
                    attributes: [
                        {
                            key: "recipient";
                            value: "terra1muzv5awgfnavnelcc79c2rptp6jj085r7hsg7c";
                        },
                        {
                            key: "amount";
                            value: "100000000uluna";
                        },
                    ];
                },
            ];
            success: true;
            msg_index: 0;
        },
    ];
    events: [
        {
            type: "message";
            attributes: [
                {
                    key: "sender";
                    value: "terra1muzv5awgfnavnelcc79c2rptp6jj085r7hsg7c";
                },
                {
                    key: "module";
                    value: "bank";
                },
                {
                    key: "action";
                    value: "send";
                },
            ];
        },
        {
            type: "transfer";
            attributes: [
                {
                    key: "recipient";
                    value: "terra1muzv5awgfnavnelcc79c2rptp6jj085r7hsg7c";
                },
                {
                    key: "amount";
                    value: "100000000uluna";
                },
            ];
        },
    ];
    height: "2521226";
    txhash: "6BCF73C2518412BE1180D9D811E758F29AC46CAB0271CB47E1A852F787FDD42A";
    raw_log: string;
    gas_used: "46405";
    timestamp: "2020-09-28T01:19:20Z";
    gas_wanted: "69400";
}

interface MessagesResponse {
    totalCnt: number;
    page: number; // 1
    limit: number;
    txs: TerraDevTx[];
}

type MessageResponse = TerraDevTx;

const extractDepositsFromTx = (chainHeight: number) => (
    tx: TerraDevTx,
): TerraTransaction[] => {
    const msgs: Array<
        TerraDevTx & {
            to_address: string;
            from_address: string;
            amount: string;
            denom: string;
            messageIndex: number;
        }
    > = [];
    try {
        const decodedMsgs = tx.tx.value.msg;
        for (let i = 0; i < decodedMsgs.length; i++) {
            const msg = decodedMsgs[i];
            if (msg.type === "bank/MsgSend") {
                for (const amount of msg.value.amount) {
                    msgs.push({
                        ...tx,
                        messageIndex: i,
                        to_address: msg.value.to_address,
                        from_address: msg.value.from_address,
                        ...amount,
                    });
                }
            }
        }
    } catch (_error) {
        return [];
    }

    return msgs.map((msg) => {
        return {
            hash: msg.txhash,
            messageIndex: msg.messageIndex,
            from: msg.from_address,
            to: msg.to_address,
            denomination: msg.denom,
            amount: msg.amount,
            memo: msg.tx.value.memo,
            confirmations: msg.height
                ? chainHeight - parseInt(msg.height, 10)
                : msg.height, // TODO
        };
    });
};

const concat = <T>(x: T[], y: T[]) => x.concat(y);

const fetchDeposits = async (
    address: string,
    network: TerraNetwork,
    memo: string | undefined = undefined,
    // page = 0,
): Promise<TerraTransaction[]> => {
    // const paramsFilterBase64 = paramsFilter && paramsFilter.toString("base64");

    // const url = `${TERRA_DEV_URL(network)}/txs?account=${address}&page=${
    //     page + 1
    // }&chainId=${network}`;
    const url = `${TERRA_DEV_URL(
        network,
    )}/txs?account=${address}&chainId=${network}`;

    const response = (
        await Axios.get<MessagesResponse>(url, {
            timeout: 60 * SECONDS,
        })
    ).data;

    const { txs } = response;

    const filteredTxs = !memo
        ? txs
        : txs.filter(
              (message) =>
                  message.tx &&
                  message.tx.value &&
                  message.tx.value.memo === memo,
          );

    // Create an entry for each message. Transactions can contain multiple
    // messages.

    // Fetch current height of the chain. Skip if no messages were found.
    const chainHeight = filteredTxs.length > 0 ? await getHeight(network) : 0;
    return filteredTxs
        .map(extractDepositsFromTx(chainHeight))
        .reduce(concat, [])
        .filter((msg) => msg.to === address);
};

const fetchDeposit = async (
    hash: string,
    messageIndex: number,
    network: TerraNetwork,
): Promise<TerraTransaction> => {
    // const paramsFilterBase64 = paramsFilter && paramsFilter.toString("base64");

    const url = `${TERRA_DEV_URL(network)}/tx/${hash}`;
    const tx = (
        await Axios.get<MessageResponse>(url, {
            timeout: 60 * SECONDS,
        })
    ).data;

    if (tx === null) {
        throw new Error(`Unable to find Terra transaction ${hash}.`);
    }

    // Create an entry for each message. Transactions can contain multiple
    // messages.

    // Fetch current height of the chain. Skip if no messages were found.
    const chainHeight = await getHeight(network);
    return extractDepositsFromTx(chainHeight)(tx)[messageIndex];
};

export const terraDev: TerraAPI = {
    fetchDeposits,
    fetchDeposit,
};
