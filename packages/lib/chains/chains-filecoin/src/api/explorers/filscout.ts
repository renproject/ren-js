export const _ = null;

// import { SECONDS } from "@renproject/utils";
// import Axios from "axios";
// import BigNumber from "bignumber.js";

// import { FilNetwork, FilTransaction } from "../../deposit";

// const FILSCOUT_URL = `https://filscoutv3api.ipfsunion.cn/`;
// const FILSCOUT_CODE_OK = 200;

// interface MessagesResponse {
//     code: number; // 200;
//     error: string; // "ok";
//     data: {
//         pagination: {
//             total: number; // 3;
//             page: number; // 1;
//             page_size: number; // 15;
//         };
//         data: [
//             {
//                 cid: string; // "bafy2bzacedvotwkz2lrughbckrw6cq66xrvqcth5mjo6xf7sbepcmbl4hwyea",
//                 block_height: number; // 82244;
//                 timestamp: number; // 1600773720;
//                 timestamp_str: string; // "2020-09-22 19:22:00";
//                 // time: string; // "2020-09-22 19:22:00";
//                 // date: string; // "2020-09-22T19:22:00+08:00";
//                 from: string; // "t1zl3sj2t7eazaojiqytccq4zlwosjxixsnf4rhyy";
//                 to: string; // "t1zl3sj2t7eazaojiqytccq4zlwosjxixsnf4rhyy";
//                 to_type: number; // 0;
//                 // value: string; // "0.001";
//                 value_str: string; // "0.001 FIL";
//                 method: string; // "Transfer";
//                 // method_type: string; // "";
//                 // receipt: number; // 0;
//                 exit_code_name: string; // "OK";
//                 // error_info_synced: false;
//                 // error_info: string; // "";
//                 // params_res: string; // "SGVsbG8gd29ybGQh";
//                 // sector_number: string; // "";
//                 // gas_fee: number; // 72444547015;
//                 // gas_fee_str: string; // "72.4445 NanoFIL";
//                 timestamp_format: string; // "2021-01-07 08:07:30"
//                 to_actor_type: string; // ""
//             },
//         ];
//     };
// }

// export class Filscout {
//     constructor(network: FilNetwork = "mainnet") {
//         if (network !== "mainnet") {
//             throw new Error(`Network ${network} not supported by Filscan.`);
//         }
//     }

//     fetchDeposits = async (
//         address: string,
//         paramsFilterBase64: string | undefined = undefined,
//         page = 0,
//         size = 15,
//     ): Promise<FilTransaction[]> => {
//         // const paramsFilterBase64 = paramsFilter && paramsFilter.toString("base64");

//         const url = `${FILSCOUT_URL}message/spec_list?address=${address}&page=${page}&page_size=${size}`;
//         const response = (
//             await Axios.get<MessagesResponse>(url, {
//                 timeout: 60 * SECONDS,
//             })
//         ).data;

//         const { code, error, data } = response;

//         if (code !== FILSCOUT_CODE_OK) {
//             throw new Error(`Unable to fetch Filecoin messages: ${error}`);
//         }

//         const { data: messages } = data;

//         return messages
//             .map(
//                 (message): FilTransaction => {
//                     return {
//                         cid: message.cid,
//                         // to: message.to,
//                         amount: new BigNumber(message.value)
//                             .times(new BigNumber(10).exponentiatedBy(18))
//                             .decimalPlaces(0)
//                             .toFixed(0),
//                         params: message.params_res,
//                         confirmations: 0, // TODO
//                         nonce: 0, // TODO
//                     };
//                 },
//             )
//             .filter(
//                 (message) =>
//                     !paramsFilterBase64 ||
//                     message.params === paramsFilterBase64,
//             );
//     };
// }
