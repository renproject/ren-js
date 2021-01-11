export const _ = null;

// // Request URL: https://api.filscan.io:8700/rpc/v1

// import { LogLevel, SimpleLogger } from "@renproject/interfaces";
// import { HttpProvider } from "@renproject/provider";
// import BigNumber from "bignumber.js";

// import { FilNetwork, FilTransaction } from "../../deposit";

// const FILSCAN_URL = `https://api.filscan.io:8700/rpc/v1`;

// interface MessageDetails {
//     height: number; // 82244;
//     cid: string; // "bafy2bzacedl4raty25kt6ujouuayfmt5lktiuk4zxocplgob7lmqzdlwqb2yg";
//     blk_cids: string[]; // ["bafy2bzaceddkc3k3vhb3mmz73pb4e6qtk7gpulwjp6rc23vnnix2uienagq3k"];
//     to: string; // "t1zl3sj2t7eazaojiqytccq4zlwosjxixsnf4rhyy";
//     from: string; // "t1zl3sj2t7eazaojiqytccq4zlwosjxixsnf4rhyy";
//     nonce: number; // 1;
//     value: string; // "0.001";
//     gas_fee_cap: string; // "131424";
//     gas_premium: string; // "130159";
//     gas_limit: number; // 556585;
//     base_fee_burn: null;
//     over_estimation_burn: null;
//     miner_penalty: null;
//     params: string; // "SGVsbG8gd29ybGQh";
//     signed_cid: string; // "bafy2bzacedvotwkz2lrughbckrw6cq66xrvqcth5mjo6xf7sbepcmbl4hwyea";
//     required_funds: string; // "73148627040";
//     gas_used: number; // 445268;
//     block_time: number; // 1600773720;
//     sig_type: number; // 1;
//     sig_data: string; // "PNaTFzSfi3SkjDghBFKT4eRDmbyz9KmFP+8ddITu/6ZkBjBvUBGP1FDbecGADsMQiUlUoEVDENQSXp1hMCXXWgE=";
//     method_name: string; // "transfer";
//     last_modified: string; // "2020-09-22T11:22:31.3144Z";
// }

// enum FilScanMessages {
//     MessageByAddress = "filscan.MessageByAddress",
//     MessageDetails = "filscan.MessageDetails",
//     StatChainInfo = "filscan.StatChainInfo",
// }

// /** MessageByAddress */

// interface MessageByAddressTypes {
//     request: Array<{
//         offset_range: {
//             start: number; // 0;
//             count: number; // 25
//         };
//         time_range: {
//             begin: number;
//             end?: number;
//         };
//         method: string; // "";
//         address: string; // "t1zl3sj2t7eazaojiqytccq4zlwosjxixsnf4rhyy";
//         from_to: "" | "to" | "from"; // "";
//     }>;
//     response: {
//         data: MessageDetails[];
//         total: 5;
//     };
// }

// // /** MessageDetails */

// // interface MessageDetailsTypes {
// //     request: string[];
// //     response: MessageDetails;
// // }

// /** StatChainInfo */

// interface StatChainInfoTypes {
//     request: [];
//     response: {
//         data: {
//             latest_height: number; // 83746;
//             latest_block_reward: string; // "11.8336746436134";
//             total_blocks: number; // 292725;
//             total_rewards: string; // "3114774.32478552";
//             power_ratio: string; // "118483831138986.6667";
//             fil_per_tera: string; // "0.469460510800867";
//             total_quality_power: string; // "320939094731390976";
//             active_miners: number; // 475;
//         };
//     };
// }

// // type StatChainInfo

// export type FilScanRequests = {
//     [FilScanMessages.MessageByAddress]: MessageByAddressTypes["request"];
//     // [FilScanMessages.MessageDetails]: MessageDetailsTypes["request"];
//     [FilScanMessages.StatChainInfo]: StatChainInfoTypes["request"];
// };

// export type FilScanResponses = {
//     [FilScanMessages.MessageByAddress]: MessageByAddressTypes["response"];
//     // [FilScanMessages.MessageDetails]: MessageDetailsTypes["response"];
//     [FilScanMessages.StatChainInfo]: StatChainInfoTypes["response"];
// };

// export class Filscan {
//     public provider: HttpProvider<FilScanRequests, FilScanResponses>;

//     constructor(network: FilNetwork = "mainnet") {
//         if (network !== "mainnet") {
//             throw new Error(`Network ${network} not supported by Filscan.`);
//         }

//         this.provider = new HttpProvider<FilScanRequests, FilScanResponses>(
//             FILSCAN_URL,
//             // new SimpleLogger(LogLevel.Trace),
//         );
//     }

//     fetchDeposits = async (
//         address: string,
//         paramsFilterBase64: string | undefined = undefined,
//         page = 0,
//         size = 25,
//     ): Promise<FilTransaction[]> => {
//         const chainStats = await this.provider.sendMessage(
//             FilScanMessages.StatChainInfo,
//             [],
//         );

//         const blockHeight = chainStats.data.latest_height;

//         const messages = (
//             await this.provider.sendMessage(FilScanMessages.MessageByAddress, [
//                 {
//                     offset_range: {
//                         start: page * size,
//                         count: size,
//                     },
//                     method: "",
//                     address,
//                     from_to: "",
//                     time_range: {
//                         begin: 0,
//                     },
//                 },
//             ])
//         ).data;

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
//                         params: message.params,
//                         confirmations: message.height
//                             ? blockHeight - message.height + 1
//                             : 0,
//                         nonce: message.nonce,
//                     };
//                 },
//             )
//             .filter(
//                 (message) =>
//                     paramsFilterBase64 === undefined ||
//                     paramsFilterBase64 === null ||
//                     paramsFilterBase64 === message.params,
//             );
//     };

//     // fetchMessage = async (cid: string): Promise<FilTransaction> => {
//     //     const provider = new HttpProvider<FilScanRequests, FilScanResponses>(
//     //         FILSCAN_URL,
//     //     );

//     //     const chainStats = await this.provider.sendMessage(
//     //         FilScanMessages.StatChainInfo,
//     //         [],
//     //     );

//     //     const blockHeight = chainStats.data.latest_height;

//     //     const message = await this.provider.sendMessage(FilScanMessages.MessageDetails, [
//     //         cid,
//     //     ]);

//     //     return {
//     //         cid: message.cid,
//     //         // to: message.to,
//     //         amount: new BigNumber(message.value)
//     //             .times(new BigNumber(10).exponentiatedBy(18))
//     //             .decimalPlaces(0)
//     //             .toFixed(0),
//     //         params: message.params,
//     //         confirmations: message.height ? blockHeight - message.height + 1 : 0,
//     //         nonce: message.nonce,
//     //     };
//     // };
// }
