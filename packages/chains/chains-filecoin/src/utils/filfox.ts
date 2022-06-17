import { utils } from "@renproject/utils";

import { FilTransaction } from "./deposit";

export class Filfox {
    public filfoxApi: string;

    public constructor(filfoxApi: string) {
        this.filfoxApi = filfoxApi;
    }

    public fetchDeposits = async (
        address: string,
        // paramsFilterBase64: string | undefined = undefined,
        page = 0,
        size = 100,
    ): Promise<{ deposits: FilTransaction[]; totalCount: number }> => {
        const heightURL = `${this.filfoxApi}tipset/recent?count=1`;

        const heightResponse = await utils.GET<FilscanHeight | FilscanError>(
            heightURL,
            {
                timeout: utils.DEFAULT_TIMEOUT * 2,
            },
        );

        if (!Array.isArray(heightResponse)) {
            throw new Error(
                `Unable to fetch latest Filecoin height: ${heightResponse.error}`,
            );
        }

        const height = heightResponse[0].height;

        const messagesURL = `${this.filfoxApi}address/${address}/messages?pageSize=${size}&page=${page}&detailed`;

        const messagesResponse = await utils.GET<
            FilscanAddressMessages | FilscanError
        >(messagesURL, {
            timeout: utils.DEFAULT_TIMEOUT * 2,
        });

        if (messagesResponse.error !== undefined) {
            throw new Error(
                `Unable to fetch Filecoin messages: ${messagesResponse.error}`,
            );
        }

        const { messages, totalCount } = messagesResponse;

        return {
            deposits: messages
                .filter((message) => message.to === address)
                .map(
                    (message): FilTransaction => ({
                        cid: message.cid,
                        // to: message.to,
                        amount: message.value,
                        params: message.params,
                        confirmations: height - message.height,
                        nonce: message.nonce,
                    }),
                ),
            // .filter(
            //     (message) =>
            //         paramsFilterBase64 === undefined ||
            //         paramsFilterBase64 === null ||
            //         message.params === paramsFilterBase64,
            // ),
            totalCount,
        };
    };

    public fetchMessage = async (cid: string): Promise<FilTransaction> => {
        const messagesURL = `${this.filfoxApi}message/${cid}`;

        const message = await utils.GET<FilscanMessage>(messagesURL, {
            timeout: utils.DEFAULT_TIMEOUT * 2,
        });

        if (message.error !== undefined && message.error !== "") {
            throw new Error(
                `Unable to fetch Filecoin messages: ${String(message.error)}`,
            );
        }

        return {
            cid: message.cid,
            // to: message.to,
            amount: message.value,
            params: message.params,
            confirmations: message.confirmations,
            nonce: message.nonce,
        };
    };
}

interface FilscanSuccess {
    statusCode: undefined;
    message: undefined;
    error: undefined;
}

interface FilscanMessage {
    cid: "bafy2bzacebhc5rzrtquqjghkgpob6hxgsbz4iqzx73erjj3tu53zgsa62uoy6";
    height: 388742;
    timestamp: 1609968660;
    confirmations: number;
    blocks: [
        "bafy2bzaceagf6axftesnfjndfpmpqx2h3a5mqmwjgoe66amfz2knd6snrb36w",
        "bafy2bzaceazsjqudhddqw6guaofx5rkpjmqsftkihlytyc4ds52kzbfhd5a7w",
        "bafy2bzacedcxeepmh2fisn4rj7ick43uqqqhieis2sn6dn4dvvgdywgu7jzdy",
    ];
    version: 0;
    from: "f12e32a3szzf6zsl6d3s5lnal6heypkzlb5nizvrq";
    fromId: "f0107606";
    fromActor: "account";
    to: "f15wjyn36z6x5ypq7f73yaolqbxyiiwkg5mmuyo2q";
    toId: "f063666";
    toActor: "account";
    nonce: 1;
    value: "795400000000000000000";
    gasLimit: 683085;
    gasFeeCap: "48861474945";
    gasPremium: "100570";
    method: "Send";
    methodNumber: 0;
    params: "b1o1UTNEV0FjSXZEZWpjMzF6UlRXUGNrdk1ZdTg5YW9tUEpyUVZZOUpaZw==";
    receipt: { exitCode: 0; return: ""; gasUsed: 549068 };
    decodedParams: "6f5a35513344574163497644656a6333317a52545750636b764d59753839616f6d504a72515659394a5a67";
    decodedReturnValue: "";
    size: 121;
    error: string; // "";
    baseFee: "4992497173";
    fee: {
        baseFeeBurn: "2741220437784764";
        overEstimationBurn: "96400127913457";
        minerPenalty: "0";
        minerTip: "68697858450";
        refund: "30538851349248654";
    };
    subcalls: [];
    transfers: [
        {
            from: "f12e32a3szzf6zsl6d3s5lnal6heypkzlb5nizvrq";
            fromId: "f0107606";
            to: "f023205";
            toId: "f023205";
            value: "68697858450";
            type: "miner-fee";
        },
        {
            from: "f12e32a3szzf6zsl6d3s5lnal6heypkzlb5nizvrq";
            fromId: "f0107606";
            to: "f099";
            toId: "f099";
            toTag: { name: "Burn Account"; signed: false };
            value: "2837620565698221";
            type: "burn-fee";
        },
        {
            from: "f12e32a3szzf6zsl6d3s5lnal6heypkzlb5nizvrq";
            fromId: "f0107606";
            to: "f15wjyn36z6x5ypq7f73yaolqbxyiiwkg5mmuyo2q";
            toId: "f063666";
            value: "795400000000000000000";
            type: "transfer";
        },
    ];
}

interface FilscanAddressMessages extends FilscanSuccess {
    totalCount: number; // 167;
    messages: Array<{
        cid: string; // "bafy2bzacebhc5rzrtquqjghkgpob6hxgsbz4iqzx73erjj3tu53zgsa62uoy6";
        height: number; // 388742;
        timestamp: number; // 1609968660;
        from: string; // "f12e32a3szzf6zsl6d3s5lnal6heypkzlb5nizvrq";
        to: string; // "f15wjyn36z6x5ypq7f73yaolqbxyiiwkg5mmuyo2q";
        nonce: number; // 1;
        value: string; // "795400000000000000000";
        method: string; // "Send";
        params: string; // "b1o1UTNEV0FjSXZEZWpjMzF6UlRXUGNrdk1ZdTg5YW9tUEpyUVZZOUpaZw==";
        receipt: {
            exitCode: 0;
            return: "";
        };
    }>;
    methods: ["Send"];
}

interface FilscanError {
    statusCode: number; // 400;
    message: string; // "Bad Request";
    error: string; // "Invalid pagination params";
}

type FilscanHeight = Array<{
    height: number; // 389254;
    timestamp: number; // 1609984020;
    messageCount: number; // 342;
    blocks: [
        {
            cid: string; // "bafy2bzacea2cbjfzqmxa67bj7ijzp4xjsn3jgds7ernjn6q7oqc365sqya3mq";
            miner: string; // "f014804";
            minerTag: {
                name: string; // "蜂巢云矿池";
                signed: boolean; // false;
            };
            messageCount: number; // 239;
            winCount: number; // 1;
            reward: string; // "17812580419321249004";
            penalty: string; // "0";
        },
    ];
}>;
