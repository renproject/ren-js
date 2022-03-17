// import { SECONDS } from "@renproject/utils";

// import { TerraAPI, TerraNetwork, TerraTransaction } from "./deposit";
// import { getHeight } from "./height";

// const STAKE_ID_URL = (network: TerraNetwork) => {
//     let prefix;
//     switch (network) {
//         case TerraNetwork.Columbus:
//             prefix = "columbus";
//             break;
//         // case TerraNetwork.Soju:
//         //     prefix = "soju";
//         //     break;
//         default:
//             throw new Error(`Terra network ${String(network)} not supported.`);
//     }
//     return `https://${String(prefix)}.stake.id/api`;
// };

// interface TerraTx {
//     time: string; // "1970-01-01T00:00:00.000000",
//     msg: string; // base64 of json-encoded DecodedMsg[],
//     memo: string; // "memo-string",
//     log: null; // null,
//     height: number; // block height,
//     hash: string; // "6BCF73C2518412BE1180D9D811E758F29AC46CAB0271CB47E1A852F787FDD42A",
//     gas_wanted: number; // 69400,
//     gas_used: number; // 46405,
//     fees: string; // "W3siZGVub20iOiJ1bHVuYSIsImFtb3VudCI6IjEwNDEwIn1d"
// }

// interface MessagesResponse {
//     status: "OK" | "Error";

//     unbondings: [];
//     txs: TerraTx[];
//     rewards: Array<{
//         denom: string;
//         amount: string;
//     }>;
//     page: {
//         total: number;
//         // eslint-disable-next-line id-blacklist
//         number: number;
//     };
//     delegations: Array<{
//         validator_address: string;
//         shares: string;
//         delegator_address: string;
//         balance: string;
//     }>;
//     balances: Array<{
//         denom: string;
//         amount: string;
//     }>;

//     errors?: string;
// }

// interface MessageResponse {
//     tx: TerraTx;
//     status: "OK" | "Error";
//     errors?: string;
// }

// interface TerraMessageTypes {
//     ["bank/MsgSend"]: {
//         value: {
//             to_address: string;
//             from_address: string;
//             amount: Array<{ denom: string; amount: string }>;
//         };
//         type: "bank/MsgSend";
//     };
// }

// type DecodedMsg = TerraMessageTypes["bank/MsgSend"];

// const extractDepositsFromTx =
//     (chainHeight: number) =>
//     (tx: TerraTx): TerraTransaction[] => {
//         const msgs: Array<
//             Omit<TerraTx, "msg"> & {
//                 to_address: string;
//                 from_address: string;
//                 amount: string;
//                 denom: string;
//                 messageIndex: number;
//             }
//         > = [];
//         try {
//             const decodedMsgs: DecodedMsg[] = JSON.parse(
//                 utils.fromBase64(tx.msg).toString(),
//             );
//             for (let i = 0; i < decodedMsgs.length; i++) {
//                 const msg = decodedMsgs[i];
//                 if (msg.type === "bank/MsgSend") {
//                     for (const amount of msg.value.amount) {
//                         msgs.push({
//                             ...tx,
//                             messageIndex: i,
//                             to_address: msg.value.to_address,
//                             from_address: msg.value.from_address,
//                             ...amount,
//                         });
//                     }
//                 }
//             }
//         } catch (_error) {
//             return [];
//         }

//         return msgs.map((msg) => ({
//             hash: msg.hash,
//             messageIndex: msg.messageIndex,
//             from: msg.from_address,
//             to: msg.to_address,
//             denomination: msg.denom,
//             amount: msg.amount,
//             memo: msg.memo,
//             confirmations: msg.height ? chainHeight - msg.height : msg.height, // TODO
//         }));
//     };

// const concat = <T>(x: T[], y: T[]) => x.concat(y);

// const fetchDeposits = async (
//     address: string,
//     network: TerraNetwork,
//     memo: string | undefined = undefined,
//     page = 0,
// ): Promise<TerraTransaction[]> => {
//     // const paramsFilterBase64 = paramsFilter && paramsFilter.toString("base64");

//     const url = `${STAKE_ID_URL(network)}/addr/${address}?page=${page + 1}`;
//     const response = (
//         await utils.GET<MessagesResponse>(url)
//     );

//     const { status, errors, txs } = response;

//     if (status !== "OK") {
//         throw new Error(
//             `Unable to fetch Terra deposits: ${String(status)}: ${String(
//                 errors,
//             )}`,
//         );
//     }

//     const filteredTxs = !memo
//         ? txs
//         : txs.filter((message) => message.memo === memo);

//     // Create an entry for each message. Transactions can contain multiple
//     // messages.

//     // Fetch current height of the chain. Skip if no messages were found.
//     const chainHeight = filteredTxs.length > 0 ? await getHeight(network) : 0;
//     return filteredTxs
//         .map(extractDepositsFromTx(chainHeight))
//         .reduce(concat, [])
//         .filter((msg) => msg.to === address);
// };

// const fetchDeposit = async (
//     hash: string,
//     messageIndex: number,
//     network: TerraNetwork,
// ): Promise<TerraTransaction> => {
//     // const paramsFilterBase64 = paramsFilter && paramsFilter.toString("base64");

//     const url = `${STAKE_ID_URL(network)}/tx/${hash}`;
//     const response = (
//         await utils.GET<MessageResponse>(url)
//     );

//     const { status, errors, tx } = response;

//     if (status !== "OK") {
//         throw new Error(
//             `Unable to fetch Terra deposit: ${String(status)}: ${String(
//                 errors,
//             )}`,
//         );
//     }

//     // Create an entry for each message. Transactions can contain multiple
//     // messages.

//     // Fetch current height of the chain. Skip if no messages were found.
//     const chainHeight = await getHeight(network);
//     return extractDepositsFromTx(chainHeight)(tx)[messageIndex];
// };

// export const stakeId: TerraAPI = {
//     fetchDeposits,
//     fetchDeposit,
// };
