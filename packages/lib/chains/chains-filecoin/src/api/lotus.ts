import FilecoinClient from "@glif/filecoin-rpc-client";

import {
    FilNetwork,
    FilTransaction,
} from "@renproject/chains-filecoin/src/deposit";

export const fetchDeposits = async (
    client: FilecoinClient,
    address: string,
    params: string | undefined | null,
    network: FilNetwork,
    progress: number,
): Promise<{ txs: FilTransaction[]; progress: number }> => {
    const chainHead = await client.request("ChainHead");
    const height: number = chainHead.Height;

    const latestTXs: Array<{ "/": string }> = await client.request(
        "StateListMessages",
        {
            Version: 0,
            To: address,
            From: null,
            Nonce: 0,
            Value: "0",
            GasPrice: "0",
            GasLimit: 0,
            Method: 0,
            Params: params,
        },
        [],
        progress === 0 ? height - 100 : progress,
    );

    return {
        txs: await Promise.all(
            (latestTXs || []).map(async (cid) =>
                fetchMessage(client, cid["/"], network, height),
            ),
        ),
        progress: height + 1,
    };
};

export const fetchMessage = async (
    client: FilecoinClient,
    cid: string,
    network: FilNetwork,
    height?: number,
): Promise<FilTransaction> => {
    const [details, receipt, { Height: chainHeight }]: [
        ChainMessage,
        StateMsg | undefined,
        { Height: number },
    ] = await Promise.all([
        client.request("ChainGetMessage", { "/": cid }),
        client.request("StateSearchMsg", { "/": cid }).catch(() => undefined),
        height ? { Height: height } : client.request("ChainHead"),
    ]);

    if (network === "testnet") {
        details.To = details.To.replace(/^f/, "t");
        details.From = details.From.replace(/^f/, "t");
    }
    const tx: FilTransaction = {
        cid,
        amount: details.Value,
        params: details.Params || "",
        nonce: details.Nonce,
        confirmations: receipt ? chainHeight - receipt.Height : 0,
    };

    return tx;
};

export interface ChainMessage {
    Version: number; // 0;
    To: string; // "t1gvyvits5chiahib7cz6uyh6kijgqgycnaiuj47i";
    From: string; // "t14wczuvodunv3xzexobzywpbj6qpr6jwdrbkrmbq";
    Nonce: number; // 20;
    Value: string; // "1000000000000000000";
    GasLimit: number; // 609960;
    GasFeeCap: string; // "101409";
    GasPremium: string; // "100355";
    Method: number; // 0;
    Params: string | null; // null;
    CID: {
        "/": string; // "bafy2bzacebhs4svm2bl5zq5geaxtywctwlo2sys7udbefpggsrouwfcepv5vu";
    };
}

export interface StateMsg {
    Message: {
        "/": string; // "bafy2bzaceaq23gg46ii4zowpnzpo33252t5lsdxxfpa5d7cyezsaczqdzefl2";
    };
    Receipt: {
        ExitCode: number; // 0;
        Return: null; // null;
        GasUsed: number; // 487968
    };
    ReturnDec: null; // null;
    TipSet: [
        {
            "/": string; // "bafy2bzaced6lrvssnkr27dd5akp4zxr2awjxjl73s5meaq42j7sacfwastfpi";
        },
    ];
    Height: number; // 174172;
}
