import FilecoinClient from "@glif/filecoin-rpc-client";

import { FilTransaction } from "./deposit";

export const getHeight = async (client: FilecoinClient): Promise<number> => {
    const chainHead = await client.request("ChainHead");
    return chainHead.Height;
};

export const fetchDeposits = async (
    client: FilecoinClient,
    address: string,
    // params: string | undefined | null,
    addressPrefix: string,
    fromHeight: number,
    latestHeight: number,
): Promise<FilTransaction[]> => {
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
            Params: undefined,
        },
        [],
        fromHeight,
    );

    return await Promise.all(
        (latestTXs || []).map(async (cid) =>
            fetchMessage(client, cid["/"], addressPrefix, latestHeight),
        ),
    );
};

export const fetchMessage = async (
    client: FilecoinClient,
    cid: string,
    addressPrefix: string,
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

    // Fix addresses.
    details.To = details.To.replace(/^f/, addressPrefix);
    details.From = details.From.replace(/^f/, addressPrefix);

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
